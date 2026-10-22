import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { db } from "../../lib/db.js";
import { env } from "../../config/env.js";
import { generateApiKey, hashApiKey } from "../../lib/apiKey.js";
import { validateIncomingKey } from "./key.service.js";

vi.mock("../../lib/db.js", () => {
  return {
    db: {
      service: {
        findFirst: vi.fn(),
      },
      apiKey: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe("API Key Module Integration", () => {
  const app = createApp();
  const userId = "user-123";
  const serviceId = "00000000-0000-0000-0000-000000000001";
  const validToken = jwt.sign(
    { userId, email: "admin@traceops.io", role: "ADMIN" },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/services/:serviceId/keys", () => {
    it("should provision a new API key and return rawKey once", async () => {
      vi.mocked(db.service.findFirst).mockResolvedValueOnce({
        id: serviceId,
        userId,
      } as any);

      vi.mocked(db.apiKey.create).mockImplementationOnce((args: any) =>
        Promise.resolve({
          id: "key-1",
          name: args.data.name,
          keyPrefix: args.data.keyPrefix,
          isActive: true,
          rateLimitMax: null,
          rateLimitWindowMs: null,
          expiresAt: null,
          createdAt: new Date(),
        }) as any
      );

      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/keys`)
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "Mobile App Production",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("rawKey");
      expect(res.body.rawKey).toMatch(/^tr_live_[a-f0-9]{8}_[a-f0-9]{48}$/);
      expect(res.body.key).toMatchObject({
        id: "key-1",
        name: "Mobile App Production",
      });
      // Ensure keyHash is not returned in the API response
      expect(res.body.key).not.toHaveProperty("keyHash");
    });

    it("should return 404 if service does not exist", async () => {
      vi.mocked(db.service.findFirst).mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/v1/services/${serviceId}/keys`)
        .set("Authorization", `Bearer ${validToken}`)
        .send({ name: "Test Key" });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Service not found");
    });
  });

  describe("GET /api/v1/services/:serviceId/keys", () => {
    it("should list service keys with secrets masked", async () => {
      vi.mocked(db.service.findFirst).mockResolvedValueOnce({
        id: serviceId,
        userId,
      } as any);

      vi.mocked(db.apiKey.findMany).mockResolvedValueOnce([
        {
          id: "key-1",
          name: "Default Key",
          keyPrefix: "tr_live_a1b2c3d4",
          isActive: true,
          rateLimitMax: 60,
          rateLimitWindowMs: 60000,
          expiresAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        } as any,
      ]);

      const res = await request(app)
        .get(`/api/v1/services/${serviceId}/keys`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.keys).toHaveLength(1);
      expect(res.body.keys[0]).toHaveProperty("keyPrefix", "tr_live_a1b2c3d4");
      expect(res.body.keys[0]).not.toHaveProperty("keyHash");
    });
  });

  describe("PATCH /api/v1/services/:serviceId/keys/:keyId/revoke", () => {
    it("should revoke an active API key", async () => {
      const keyId = "00000000-0000-0000-0000-000000000002";
      vi.mocked(db.service.findFirst).mockResolvedValueOnce({ id: serviceId, userId } as any);
      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce({ id: keyId, serviceId } as any);
      vi.mocked(db.apiKey.update).mockResolvedValueOnce({
        id: keyId,
        name: "Test Key",
        keyPrefix: "tr_live_a1b2c3d4",
        isActive: false,
        updatedAt: new Date(),
      } as any);

      const res = await request(app)
        .patch(`/api/v1/services/${serviceId}/keys/${keyId}/revoke`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("revoked successfully");
      expect(res.body.key.isActive).toBe(false);
    });
  });

  describe("validateIncomingKey (Data Plane Verification)", () => {
    it("should return MISSING_KEY when rawKey is omitted", async () => {
      const result = await validateIncomingKey(undefined, serviceId);
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("MISSING_KEY");
    });

    it("should return MALFORMED_KEY for non-matching key string", async () => {
      const result = await validateIncomingKey("bearer-random-token", serviceId);
      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("MALFORMED_KEY");
    });

    it("should successfully validate an authentic active key", async () => {
      const generated = generateApiKey();
      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce({
        id: "key-1",
        name: "Live Key",
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        serviceId,
        isActive: true,
        rateLimitMax: null,
        rateLimitWindowMs: null,
        expiresAt: null,
        service: {
          id: serviceId,
          name: "Test API",
          slug: "test-api",
          upstreamUrl: "https://example.com",
          routePrefix: "",
          timeoutMs: 5000,
          allowedMethods: ["GET"],
          rateLimitMax: 60,
          rateLimitWindowMs: 60000,
          isActive: true,
        },
      } as any);
      vi.mocked(db.apiKey.update).mockResolvedValueOnce({} as any);

      const result = await validateIncomingKey(generated.rawKey, serviceId);

      expect(result.isValid).toBe(true);
      expect(result.key?.id).toBe("key-1");
      expect(result.service?.slug).toBe("test-api");
    });

    it("should reject revoked keys", async () => {
      const generated = generateApiKey();
      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce({
        id: "key-revoked",
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        serviceId,
        isActive: false, // Revoked
        service: { isActive: true },
      } as any);

      const result = await validateIncomingKey(generated.rawKey, serviceId);

      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("KEY_REVOKED");
    });

    it("should reject expired keys", async () => {
      const generated = generateApiKey();
      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce({
        id: "key-expired",
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        serviceId,
        isActive: true,
        expiresAt: new Date(Date.now() - 10000), // Expired in past
        service: { isActive: true },
      } as any);

      const result = await validateIncomingKey(generated.rawKey, serviceId);

      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("KEY_EXPIRED");
    });

    it("should reject cross-service key attempts", async () => {
      const generated = generateApiKey();
      // Key is sought for service B, but DB query returns null because serviceId constraint doesn't match
      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce(null);

      const result = await validateIncomingKey(generated.rawKey, "different-service-id");

      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("KEY_NOT_FOUND");
    });

    it("should reject tampered key secrets", async () => {
      const generated = generateApiKey();
      // Store real hash, but caller presents tampered secret
      const tamperedKey = generated.rawKey.slice(0, -1) + "0";

      vi.mocked(db.apiKey.findFirst).mockResolvedValueOnce({
        id: "key-1",
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        serviceId,
        isActive: true,
        expiresAt: null,
        service: { isActive: true },
      } as any);

      const result = await validateIncomingKey(tamperedKey, serviceId);

      expect(result.isValid).toBe(false);
      expect(result.failureReason).toBe("INVALID_KEY_SECRET");
    });
  });
});
