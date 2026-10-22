import { describe, it, expect } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  extractKeyPrefix,
  verifyKeyHash,
} from "./apiKey.js";

describe("API Key Cryptographic Utilities", () => {
  it("should generate a valid key matching the tr_live_<8>_<48> format", () => {
    const key = generateApiKey();

    expect(key.rawKey).toMatch(/^tr_live_[a-f0-9]{8}_[a-f0-9]{48}$/);
    expect(key.keyPrefix).toMatch(/^tr_live_[a-f0-9]{8}$/);
    expect(key.keyHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 is 64 hex characters (256 bits)
  });

  it("should produce unique keys with distinct prefixes and hashes on each call", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyPrefix).not.toBe(key2.keyPrefix);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  it("should extract key prefix accurately", () => {
    const key = generateApiKey();
    const extracted = extractKeyPrefix(key.rawKey);

    expect(extracted).toBe(key.keyPrefix);
  });

  it("should return null when attempting to extract prefix from invalid or tampered key strings", () => {
    expect(extractKeyPrefix("invalid-key")).toBeNull();
    expect(extractKeyPrefix("tr_live_short_key")).toBeNull();
    expect(extractKeyPrefix("tr_test_a1b2c3d4_8f9e0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d")).toBeNull();
  });

  it("should verify valid key hashes in constant time", () => {
    const key = generateApiKey();

    expect(verifyKeyHash(key.rawKey, key.keyHash)).toBe(true);
  });

  it("should reject tampered or modified keys", () => {
    const key = generateApiKey();
    // Tamper with the last character of the secret
    const lastChar = key.rawKey.slice(-1);
    const tamperedChar = lastChar === "a" ? "b" : "a";
    const tamperedKey = key.rawKey.slice(0, -1) + tamperedChar;

    expect(verifyKeyHash(tamperedKey, key.keyHash)).toBe(false);
  });

  it("should produce deterministic SHA-256 hashes", () => {
    const hash1 = hashApiKey("test_key_sample");
    const hash2 = hashApiKey("test_key_sample");

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});
