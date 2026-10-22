import crypto from "node:crypto";

export interface GeneratedKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

const KEY_PREFIX_IDENTIFIER = "tr_live";
const KEY_REGEX = /^tr_live_([a-f0-9]{8})_([a-f0-9]{48})$/;

/**
 * Generates a cryptographically secure API key formatted as:
 * tr_live_<8_hex_prefix>_<48_hex_secret>
 *
 * Example:
 * tr_live_a1b2c3d4_8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d
 */
export function generateApiKey(): GeneratedKey {
  // 4 bytes = 8 hex characters for the indexed lookup prefix
  const prefixHex = crypto.randomBytes(4).toString("hex");

  // 24 bytes = 48 hex characters for the secret payload (192 bits of entropy)
  const secretHex = crypto.randomBytes(24).toString("hex");

  const rawKey = `${KEY_PREFIX_IDENTIFIER}_${prefixHex}_${secretHex}`;
  const keyPrefix = `${KEY_PREFIX_IDENTIFIER}_${prefixHex}`;
  const keyHash = hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix,
    keyHash,
  };
}

/**
 * Computes a SHA-256 cryptographic digest of a raw API key.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Extracts the indexed prefix from a raw API key if the format matches.
 * Returns null if the format is invalid.
 */
export function extractKeyPrefix(rawKey: string): string | null {
  const match = rawKey.match(KEY_REGEX);
  if (!match) return null;
  return `${KEY_PREFIX_IDENTIFIER}_${match[1]}`;
}

/**
 * Constant-time comparison of a candidate key hash against a stored hash.
 * Prevents timing side-channel attacks by ensuring execution time is invariant
 * to where any character mismatch occurs.
 */
export function verifyKeyHash(candidateRawKey: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(candidateRawKey);

  const candidateBuffer = Buffer.from(candidateHash, "utf8");
  const storedBuffer = Buffer.from(storedHash, "utf8");

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}
