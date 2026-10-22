import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { startMockUpstream, MockUpstreamServer } from "../tests/mockUpstream.js";
import { generateApiKey } from "../lib/apiKey.js";

vi.mock("../lib/redis.js", () => {
  return {
    redis: {
      eval: vi.fn(),
    },
  };
});

vi.mock("../lib/db.js", () => {
  return {
    db: {
      service: {
        findUnique: vi.fn(),
      },
      apiKey: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      requestLog: {
        create: vi.fn(),
      },
    },
  };
});

describe("Gateway Telemetry & Logging Middleware", () => {
  const app = createApp();
  let mockUpstream: MockUpstreamServer;

  const serviceId = "00000000-0000-0000-0000-000000000001";
  const serviceSlug = "telemetry-service";
  const validKey = generateApiKey();

  beforeAll(async () => {
    mockUpstream = await startMockUpstream();
  });

  afterAll(async () => {
    await mockUpstream.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMocks() {
    const serviceRecord = {
      id: serviceId,
      name: "Telemetry Service",
      slug: serviceSlug,
      upstreamUrl: mockUpstream.baseUrl,
      routePrefix: "",
      isActive: true,
      timeoutMs: 2000,
      allowedMethods: ["GET", "POST"],
      rateLimitMax: 60,
      rateLimitWindowMs: 60000,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.service.findUnique).mockResolvedValue(serviceRecord as any);

    vi.mocked(db.apiKey.findFirst).mockImplementation((args: any): any => {
      if (args.where?.keyPrefix === validKey.keyPrefix && args.where?.serviceId === serviceId) {
        return Promise.resolve({
          id: "key-123",
          name: "Test Key",
          keyPrefix: validKey.keyPrefix,
          keyHash: validKey.keyHash,
          isActive: true,
          expiresAt: null,
          rateLimitMax: null,
          rateLimitWindowMs: null,
          service: serviceRecord,
        } as any);
      }
      return Promise.resolve(null);
    });

    vi.mocked(db.apiKey.update).mockResolvedValue({} as any);
    vi.mocked(redis.eval).mockResolvedValue([1, 59, 60]);
    vi.mocked(db.requestLog.create).mockResolvedValue({} as any);

    return serviceRecord;
  }

  it("should asynchronously record requestLog for successful 200 proxy requests", async () => {
    setupMocks();

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(200);

    // Give microtask event loop a tick for res.on('finish') callback
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(db.requestLog.create).toHaveBeenCalledTimes(1);
    expect(db.requestLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId,
        apiKeyId: "key-123",
        method: "GET",
        path: `/gateway/${serviceSlug}/hello`,
        statusCode: 200,
        failureCategory: null,
      }),
    });
  });

  it("should record requestLog with AUTH_FAILED category when API key is missing", async () => {
    setupMocks();

    const res = await request(app).get(`/gateway/${serviceSlug}/hello`);

    expect(res.status).toBe(401);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(db.requestLog.create).toHaveBeenCalledTimes(1);
    expect(db.requestLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId,
        apiKeyId: null,
        method: "GET",
        statusCode: 401,
        failureCategory: "AUTH_FAILED",
      }),
    });
  });

  it("should record requestLog with RATE_LIMITED category when rate limit is exceeded", async () => {
    setupMocks();
    vi.mocked(redis.eval).mockResolvedValueOnce([0, 0, 15]); // Denied

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(db.requestLog.create).toHaveBeenCalledTimes(1);
    expect(db.requestLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId,
        apiKeyId: "key-123",
        method: "GET",
        statusCode: 429,
        failureCategory: "RATE_LIMITED",
      }),
    });
  });
});
