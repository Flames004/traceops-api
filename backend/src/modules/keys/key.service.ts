import { db } from "../../lib/db.js";
import { AppError } from "../../middleware/errorHandler.js";
import {
  generateApiKey,
  extractKeyPrefix,
  verifyKeyHash,
} from "../../lib/apiKey.js";
import { CreateApiKeyInput } from "./key.schemas.js";
import { logger } from "../../lib/logger.js";

export async function createApiKey(
  userId: string,
  serviceId: string,
  input: CreateApiKeyInput
) {
  // Ensure the service exists and is owned by the authenticated user
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  const generated = generateApiKey();

  const keyRecord = await db.apiKey.create({
    data: {
      name: input.name,
      keyPrefix: generated.keyPrefix,
      keyHash: generated.keyHash,
      serviceId,
      rateLimitMax: input.rateLimitMax,
      rateLimitWindowMs: input.rateLimitWindowMs,
      expiresAt: input.expiresAt,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      rateLimitMax: true,
      rateLimitWindowMs: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    // SECURITY: The plaintext rawKey is returned ONLY on initial generation
    rawKey: generated.rawKey,
    key: keyRecord,
  };
}

export async function listApiKeys(userId: string, serviceId: string) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  const keys = await db.apiKey.findMany({
    where: { serviceId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      rateLimitMax: true,
      rateLimitWindowMs: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      // keyHash is intentionally omitted to avoid leaking verification digests
    },
    orderBy: { createdAt: "desc" },
  });

  return keys;
}

export async function revokeApiKey(
  userId: string,
  serviceId: string,
  keyId: string
) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  const key = await db.apiKey.findFirst({
    where: { id: keyId, serviceId },
  });

  if (!key) {
    throw new AppError("API key not found.", 404);
  }

  const updatedKey = await db.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return {
    message: "API key revoked successfully",
    key: updatedKey,
  };
}

export async function deleteApiKey(
  userId: string,
  serviceId: string,
  keyId: string
) {
  const service = await db.service.findFirst({
    where: { id: serviceId, userId },
  });

  if (!service) {
    throw new AppError("Service not found.", 404);
  }

  const key = await db.apiKey.findFirst({
    where: { id: keyId, serviceId },
  });

  if (!key) {
    throw new AppError("API key not found.", 404);
  }

  await db.apiKey.delete({
    where: { id: keyId },
  });

  return { message: "API key deleted successfully" };
}

export type KeyValidationFailureReason =
  | "MISSING_KEY"
  | "MALFORMED_KEY"
  | "KEY_NOT_FOUND"
  | "KEY_REVOKED"
  | "SERVICE_INACTIVE"
  | "KEY_EXPIRED"
  | "INVALID_KEY_SECRET";

export interface KeyValidationResult {
  isValid: boolean;
  failureReason?: KeyValidationFailureReason;
  key?: {
    id: string;
    name: string;
    keyPrefix: string;
    rateLimitMax: number | null;
    rateLimitWindowMs: number | null;
  };
  service?: {
    id: string;
    name: string;
    slug: string;
    upstreamUrl: string;
    routePrefix: string;
    timeoutMs: number;
    allowedMethods: string[];
    rateLimitMax: number;
    rateLimitWindowMs: number;
  };
}

/**
 * High-performance API key validator used by the Data Plane (Gateway Reverse Proxy).
 * 1. Extracts key prefix in O(1) time
 * 2. Fetches matching active key from DB/Cache by index
 * 3. Enforces service binding, revocation, and expiration
 * 4. Performs constant-time hash comparison
 */
export async function validateIncomingKey(
  rawKey: string | undefined,
  serviceId: string
): Promise<KeyValidationResult> {
  if (!rawKey) {
    return { isValid: false, failureReason: "MISSING_KEY" };
  }

  const keyPrefix = extractKeyPrefix(rawKey);
  if (!keyPrefix) {
    return { isValid: false, failureReason: "MALFORMED_KEY" };
  }

  // Fast index query by keyPrefix and serviceId
  const keyRecord = await db.apiKey.findFirst({
    where: {
      keyPrefix,
      serviceId, // Strict service boundary: prevents cross-service key reuse
    },
    include: {
      service: true,
    },
  });

  if (!keyRecord) {
    return { isValid: false, failureReason: "KEY_NOT_FOUND" };
  }

  if (!keyRecord.isActive) {
    return { isValid: false, failureReason: "KEY_REVOKED" };
  }

  if (!keyRecord.service.isActive) {
    return { isValid: false, failureReason: "SERVICE_INACTIVE" };
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return { isValid: false, failureReason: "KEY_EXPIRED" };
  }

  // Constant-time SHA-256 hash comparison
  const isMatch = verifyKeyHash(rawKey, keyRecord.keyHash);
  if (!isMatch) {
    return { isValid: false, failureReason: "INVALID_KEY_SECRET" };
  }

  // Non-blocking fire-and-forget update of lastUsedAt
  try {
    const updatePromise = db.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    });
    if (updatePromise && typeof updatePromise.catch === "function") {
      updatePromise.catch((err) => {
        logger.warn("Failed to update apiKey lastUsedAt timestamp", { error: err.message });
      });
    }
  } catch (err: any) {
    logger.warn("Failed to update apiKey lastUsedAt timestamp", { error: err.message });
  }

  return {
    isValid: true,
    key: {
      id: keyRecord.id,
      name: keyRecord.name,
      keyPrefix: keyRecord.keyPrefix,
      rateLimitMax: keyRecord.rateLimitMax,
      rateLimitWindowMs: keyRecord.rateLimitWindowMs,
    },
    service: keyRecord.service,
  };
}
