import { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { logger } from "../lib/logger.js";

// RFC 7230 §6.1 Hop-by-hop headers that proxies must not forward
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

// Headers to strip for security to avoid leaking gateway secrets to upstreams
const GATEWAY_SECURITY_HEADERS = new Set([
  "x-api-key",
  "authorization",
]);

/**
 * Filters and sanitizes client headers for forwarding to upstream.
 */
function prepareForwardHeaders(req: Request, clientIp: string, requestId: string): Record<string, string> {
  const forwarded: Record<string, string> = {};

  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerKey) || GATEWAY_SECURITY_HEADERS.has(lowerKey)) {
      continue;
    }
    if (typeof value === "string") {
      forwarded[key] = value;
    } else if (Array.isArray(value)) {
      forwarded[key] = value.join(", ");
    }
  }

  // Inject proxy transparency headers
  forwarded["x-forwarded-for"] = clientIp;
  forwarded["x-forwarded-proto"] = req.protocol;
  forwarded["x-forwarded-host"] = req.get("host") || "traceops-gateway";
  forwarded["x-gateway-request-id"] = requestId;

  return forwarded;
}

/**
 * Reverse Proxy Forwarder:
 * Sends the sanitized client request to the resolved upstream service and streams back the result.
 */
export async function gatewayForwarder(req: Request, res: Response): Promise<void> {
  const context = req.gatewayContext;
  if (!context) {
    res.status(500).json({ error: "Gateway internal error: Missing routing context." });
    return;
  }

  const { targetUrl, service, clientIp, requestId, startTime } = context;
  const headers = prepareForwardHeaders(req, clientIp, requestId);

  try {
    const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase()) && req.body;

    const upstreamResponse = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: hasBody ? req.body : undefined,
      headers,
      timeout: service.timeoutMs,
      validateStatus: () => true, // Don't throw on 4xx/5xx responses; return upstream response directly
      maxRedirects: 0, // Prevent SSRF bypass via 3xx redirects
    });

    const latencyMs = Date.now() - startTime;

    // Forward safe upstream response headers
    for (const [key, value] of Object.entries(upstreamResponse.headers)) {
      const lower = key.toLowerCase();
      if (!HOP_BY_HOP_HEADERS.has(lower) && lower !== "content-length") {
        if (typeof value === "string" || typeof value === "number" || Array.isArray(value)) {
          res.setHeader(key, value as any);
        }
      }
    }

    // Set gateway telemetry response headers
    res.setHeader("X-Gateway-Request-Id", requestId);
    res.setHeader("X-Gateway-Latency-Ms", latencyMs.toString());

    res.status(upstreamResponse.status).send(upstreamResponse.data);
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    res.setHeader("X-Gateway-Request-Id", requestId);
    res.setHeader("X-Gateway-Latency-Ms", latencyMs.toString());

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;

      // Upstream Timeout (HTTP 504)
      if (axiosErr.code === "ECONNABORTED" || axiosErr.message.includes("timeout")) {
        logger.warn(`Gateway Timeout: Upstream '${service.name}' exceeded ${service.timeoutMs}ms`, {
          serviceSlug: service.slug,
          targetUrl,
          latencyMs,
        });

        res.status(504).json({
          error: `Gateway Timeout: Upstream service '${service.name}' did not respond within ${service.timeoutMs}ms.`,
          code: "UPSTREAM_TIMEOUT",
        });
        return;
      }

      // Upstream Connection Refused / Unreachable (HTTP 502)
      if (
        axiosErr.code === "ECONNREFUSED" ||
        axiosErr.code === "ENOTFOUND" ||
        axiosErr.code === "EHOSTUNREACH" ||
        axiosErr.code === "ENETUNREACH"
      ) {
        logger.warn(`Bad Gateway: Unable to connect to upstream '${service.name}'`, {
          serviceSlug: service.slug,
          targetUrl,
          errorCode: axiosErr.code,
        });

        res.status(502).json({
          error: `Bad Gateway: Unable to establish connection to upstream service '${service.name}'.`,
          code: "UPSTREAM_UNREACHABLE",
        });
        return;
      }
    }

    // General upstream proxy failure
    logger.error("Gateway proxy error forwarding request", err, {
      serviceSlug: service.slug,
      targetUrl,
      latencyMs,
    });

    res.status(502).json({
      error: "Bad Gateway: An error occurred while proxying to the upstream service.",
      code: "BAD_GATEWAY",
    });
  }
}
