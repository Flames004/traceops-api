import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { db } from "../lib/db.js";
import { startMockUpstream, MockUpstreamServer } from "../tests/mockUpstream.js";
import { generateApiKey } from "../lib/apiKey.js";
import { redis } from "../lib/redis.js";

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
        create: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe("Gateway Reverse Proxy Pipeline", () => {
  const app = createApp();
  let mockUpstream: MockUpstreamServer;

  const serviceId = "00000000-0000-0000-0000-000000000001";
  const serviceSlug = "mock-service";
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

  function setupServiceMock(overrides?: Partial<any>) {
    const serviceRecord = {
      id: serviceId,
      name: "Mock Service",
      slug: serviceSlug,
      description: "Test upstream service",
      upstreamUrl: mockUpstream.baseUrl,
      routePrefix: "",
      isActive: true,
      timeoutMs: 2000,
      allowedMethods: ["GET", "POST", "PUT", "DELETE"],
      rateLimitMax: 60,
      rateLimitWindowMs: 60000,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    vi.mocked(db.service.findUnique).mockResolvedValue(serviceRecord as any);

    vi.mocked(db.apiKey.findFirst).mockImplementation((args: any): any => {
      if (args.where?.keyPrefix === validKey.keyPrefix && args.where?.serviceId === serviceId) {
        return Promise.resolve({
          id: "key-1",
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
    return serviceRecord;
  }

  it("should forward GET request to upstream and return response with gateway headers", async () => {
    setupServiceMock();

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Hello from mock upstream!" });
    expect(res.headers).toHaveProperty("x-gateway-request-id");
    expect(res.headers).toHaveProperty("x-gateway-latency-ms");
  });

  it("should forward POST request with body and query parameters", async () => {
    setupServiceMock();

    const payload = { user: "Alice", role: "developer" };

    const res = await request(app)
      .post(`/gateway/${serviceSlug}/echo?filter=active&limit=10`)
      .set("x-api-key", validKey.rawKey)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.body).toEqual(payload);
    expect(res.body.query).toEqual({ filter: "active", limit: "10" });
  });

  it("should strip hop-by-hop and sensitive headers (x-api-key) before forwarding upstream", async () => {
    setupServiceMock();

    const res = await request(app)
      .post(`/gateway/${serviceSlug}/echo`)
      .set("x-api-key", validKey.rawKey)
      .set("Authorization", `Bearer ${validKey.rawKey}`)
      .set("X-Custom-Header", "allowed-header-value");

    expect(res.status).toBe(200);
    const upstreamReceivedHeaders = res.body.headers;

    // x-api-key and Authorization MUST NOT leak to the upstream
    expect(upstreamReceivedHeaders).not.toHaveProperty("x-api-key");
    expect(upstreamReceivedHeaders).not.toHaveProperty("authorization");

    // Custom safe headers and proxy transparency headers should be present
    expect(upstreamReceivedHeaders).toHaveProperty("x-custom-header", "allowed-header-value");
    expect(upstreamReceivedHeaders).toHaveProperty("x-forwarded-for");
    expect(upstreamReceivedHeaders).toHaveProperty("x-gateway-request-id");
  });

  it("should return 401 when API key is missing", async () => {
    setupServiceMock();

    const res = await request(app).get(`/gateway/${serviceSlug}/hello`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MISSING_KEY");
  });

  it("should return 401 when API key secret is invalid", async () => {
    setupServiceMock();

    const tamperedKey = validKey.rawKey.slice(0, -1) + "0";

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", tamperedKey);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_KEY_SECRET");
  });

  it("should return 405 when HTTP method is not allowed for the service", async () => {
    setupServiceMock({ allowedMethods: ["GET"] }); // Only GET allowed

    const res = await request(app)
      .delete(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(405);
    expect(res.body.code).toBe("METHOD_NOT_ALLOWED");
  });

  it("should return 503 when service is disabled", async () => {
    setupServiceMock({ isActive: false });

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SERVICE_DISABLED");
  });

  it("should return 404 when service slug does not exist", async () => {
    vi.mocked(db.service.findUnique).mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/gateway/non-existent-service/hello")
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("SERVICE_NOT_FOUND");
  });

  it("should return 504 Gateway Timeout when upstream takes longer than timeoutMs", async () => {
    // Configure strict 100ms timeout
    setupServiceMock({ timeoutMs: 100 });

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/delay?ms=300`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(504);
    expect(res.body.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("should return 502 Bad Gateway when upstream is unreachable", async () => {
    // Port 59999 has no server listening
    setupServiceMock({ upstreamUrl: "http://127.0.0.1:59999" });

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("UPSTREAM_UNREACHABLE");
  });

  it("should transparently propagate upstream 500 status code", async () => {
    setupServiceMock();

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/status/500`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ status: 500, message: "Simulated upstream status 500" });
  });

  it("should inject RateLimit headers on permitted requests", async () => {
    setupServiceMock();
    vi.mocked(redis.eval).mockResolvedValueOnce([1, 42, 60]);

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("ratelimit-limit", "60");
    expect(res.headers).toHaveProperty("ratelimit-remaining", "42");
    expect(res.headers).toHaveProperty("ratelimit-reset", "60");
  });

  it("should return 429 and Retry-After header when rate limit is exceeded", async () => {
    setupServiceMock();
    // Simulate Redis returning 0 allowed, 0 remaining, 18s reset
    vi.mocked(redis.eval).mockResolvedValueOnce([0, 0, 18]);

    const res = await request(app)
      .get(`/gateway/${serviceSlug}/hello`)
      .set("x-api-key", validKey.rawKey);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res.body.retryAfterSeconds).toBe(18);
    expect(res.headers).toHaveProperty("retry-after", "18");
    expect(res.headers).toHaveProperty("ratelimit-remaining", "0");
  });
});
