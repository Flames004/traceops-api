import { Request, Response, NextFunction } from "express";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";

/**
 * Maps HTTP status codes to standardized gateway failure categories.
 */
function determineFailureCategory(statusCode: number): string | null {
  if (statusCode < 400) return null;
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "AUTH_FAILED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 429:
      return "RATE_LIMITED";
    case 502:
      return "UPSTREAM_UNREACHABLE";
    case 503:
      return "SERVICE_DISABLED";
    case 504:
      return "UPSTREAM_TIMEOUT";
    default:
      return statusCode >= 500 ? "UPSTREAM_ERROR" : "CLIENT_ERROR";
  }
}

/**
 * Asynchronous Telemetry Middleware:
 * Hooks into the HTTP response 'finish' event to record gateway request metrics in PostgreSQL
 * AFTER the response has already been sent to the client (zero added latency to client transit).
 */
export function gatewayTelemetry(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestStartTime = Date.now();

  res.on("finish", () => {
    const context = req.gatewayContext;
    // Only log if the request was routed to a recognized service
    if (!context || !context.service?.id) {
      return;
    }

    const latencyMs = Math.max(1, Date.now() - (context.startTime || requestStartTime));
    const statusCode = res.statusCode;
    const failureCategory = determineFailureCategory(statusCode);

    // Sanitize path: remove query parameters and secret tokens
    const rawPath = req.originalUrl || req.url;
    const sanitizedPath = rawPath.split("?")[0];

    // Non-blocking fire-and-forget database persistence
    if (db.requestLog && typeof db.requestLog.create === "function") {
      db.requestLog
        .create({
          data: {
            serviceId: context.service.id,
            apiKeyId: context.apiKey?.id ?? null,
            method: req.method.toUpperCase(),
            path: sanitizedPath,
            statusCode,
            latencyMs,
            clientIp: context.clientIp || "unknown",
            userAgent: (req.headers["user-agent"] as string)?.slice(0, 255) || null,
            failureCategory,
            errorMessage: statusCode >= 400 ? `HTTP ${statusCode} ${failureCategory}` : null,
          },
        })
        .catch((err: any) => {
          logger.error("Failed to asynchronously persist gateway request log", err, {
            serviceId: context.service.id,
            statusCode,
            latencyMs,
          });
        });
    }
  });

  next();
}
