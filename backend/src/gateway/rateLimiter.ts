import { Request, Response, NextFunction } from "express";
import { checkRateLimit, RateLimitConfig } from "../rate-limiting/slidingWindow.js";

/**
 * Gateway Rate Limiter Middleware:
 * Enforces per-key or per-service atomic sliding window limits before proxy forwarding.
 */
export async function gatewayRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const context = req.gatewayContext;
  if (!context) {
    res.status(500).json({ error: "Gateway internal error: Missing routing context." });
    return;
  }

  // 1. Determine rate limit configuration (Key overrides Service)
  const config: RateLimitConfig = {
    limit: context.apiKey?.rateLimitMax ?? context.service.rateLimitMax,
    windowMs: context.apiKey?.rateLimitWindowMs ?? context.service.rateLimitWindowMs,
  };

  // 2. Determine rate limit key partition
  const rateLimitKey = context.apiKey
    ? `${context.service.id}:${context.apiKey.id}`
    : `${context.service.id}:ip:${context.clientIp}`;

  // 3. Evaluate atomic sliding window in Redis
  const result = await checkRateLimit(rateLimitKey, config, true);

  // 4. Inject standard IETF/RFC rate limit telemetry headers
  res.setHeader("RateLimit-Limit", result.limit.toString());
  res.setHeader("RateLimit-Remaining", result.remaining.toString());
  res.setHeader("RateLimit-Reset", result.resetSeconds.toString());

  if (!result.allowed) {
    res.setHeader("Retry-After", result.resetSeconds.toString());
    res.status(429).json({
      error: `Too Many Requests: Rate limit exceeded for service '${context.service.name}'.`,
      code: "RATE_LIMIT_EXCEEDED",
      limit: result.limit,
      retryAfterSeconds: result.resetSeconds,
    });
    return;
  }

  next();
}
