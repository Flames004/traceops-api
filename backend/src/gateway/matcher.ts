import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { db } from "../lib/db.js";
import { GatewayContext } from "./types.js";

/**
 * Route Matcher Middleware:
 * 1. Matches /gateway/:serviceSlug/*
 * 2. Resolves service configuration
 * 3. Enforces service availability and HTTP method whitelisting
 * 4. Assembles upstream target URL
 */
export async function gatewayMatcher(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const serviceSlug = req.params.serviceSlug;

  if (!serviceSlug) {
    res.status(400).json({ error: "Missing service identifier in gateway path.", code: "BAD_GATEWAY_PATH" });
    return;
  }

  try {
    const service = await db.service.findUnique({
      where: { slug: serviceSlug },
    });

    if (!service) {
      res.status(404).json({
        error: `Service '${serviceSlug}' not found. Please verify the registered service route.`,
        code: "SERVICE_NOT_FOUND",
      });
      return;
    }

    if (!service.isActive) {
      res.status(503).json({
        error: `Service '${service.name}' is temporarily disabled.`,
        code: "SERVICE_DISABLED",
      });
      return;
    }

    // Check HTTP Method Whitelist
    const methodUpper = req.method.toUpperCase();
    if (!service.allowedMethods.includes(methodUpper)) {
      res.status(405).json({
        error: `HTTP method '${methodUpper}' is not allowed for service '${service.name}'. Allowed: ${service.allowedMethods.join(", ")}`,
        code: "METHOD_NOT_ALLOWED",
      });
      return;
    }

    // Extract remainder sub-path (e.g. /gateway/my-service/users/list -> /users/list)
    const wildcardPath = req.params[0] || "";
    const cleanSubPath = wildcardPath.startsWith("/") ? wildcardPath : `/${wildcardPath}`;

    // Construct upstream target URL
    const upstreamBase = new URL(service.upstreamUrl);
    const basePath = upstreamBase.pathname.replace(/\/$/, "");
    const prefix = service.routePrefix ? service.routePrefix.replace(/\/$/, "") : "";
    const combinedPath = `${basePath}${prefix}${cleanSubPath}`;

    upstreamBase.pathname = combinedPath.replace(/\/+/g, "/"); // Normalize multiple slashes

    const gatewayContext: GatewayContext = {
      requestId: crypto.randomUUID(),
      service: {
        id: service.id,
        name: service.name,
        slug: service.slug,
        upstreamUrl: service.upstreamUrl,
        routePrefix: service.routePrefix,
        timeoutMs: service.timeoutMs,
        allowedMethods: service.allowedMethods,
        rateLimitMax: service.rateLimitMax,
        rateLimitWindowMs: service.rateLimitWindowMs,
        isActive: service.isActive,
      },
      startTime: Date.now(),
      targetSubPath: cleanSubPath,
      targetUrl: upstreamBase.toString(),
      clientIp: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown",
    };

    req.gatewayContext = gatewayContext;
    next();
  } catch (err: any) {
    res.status(500).json({
      error: "Gateway error while resolving service route.",
      details: err.message,
    });
  }
}
