import { Request, Response, NextFunction } from "express";
import { validateIncomingKey } from "../modules/keys/key.service.js";

/**
 * Extracts raw API key from either x-api-key header or Authorization Bearer header.
 */
function extractRawApiKey(req: Request): string | undefined {
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string" && xApiKey.trim()) {
    return xApiKey.trim();
  }

  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.substring(7).trim();
    if (candidate.startsWith("tr_live_")) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Gateway Authentication Middleware:
 * Verifies client API key against the service bound in req.gatewayContext.
 */
export async function gatewayAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const context = req.gatewayContext;
  if (!context) {
    res.status(500).json({ error: "Gateway internal error: Missing routing context." });
    return;
  }

  const rawKey = extractRawApiKey(req);

  if (!rawKey) {
    res.status(401).json({
      error: "Unauthorized: Missing API key. Provide 'x-api-key' or 'Authorization: Bearer <key>'.",
      code: "MISSING_KEY",
    });
    return;
  }

  const validation = await validateIncomingKey(rawKey, context.service.id);

  if (!validation.isValid) {
    switch (validation.failureReason) {
      case "MALFORMED_KEY":
        res.status(401).json({ error: "Unauthorized: Malformed API key format.", code: "MALFORMED_KEY" });
        return;
      case "KEY_REVOKED":
        res.status(401).json({ error: "Unauthorized: This API key has been revoked.", code: "KEY_REVOKED" });
        return;
      case "KEY_EXPIRED":
        res.status(401).json({ error: "Unauthorized: This API key has expired.", code: "KEY_EXPIRED" });
        return;
      case "SERVICE_INACTIVE":
        res.status(503).json({ error: "Service is currently disabled.", code: "SERVICE_INACTIVE" });
        return;
      case "KEY_NOT_FOUND":
      case "INVALID_KEY_SECRET":
      default:
        res.status(401).json({
          error: "Unauthorized: Invalid API key or key does not belong to this service.",
          code: validation.failureReason || "INVALID_KEY",
        });
        return;
    }
  }

  // Attach key context
  context.apiKey = validation.key;
  next();
}
