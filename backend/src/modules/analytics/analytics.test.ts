import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { db } from "../../lib/db.js";
import { env } from "../../config/env.js";

vi.mock("../../lib/db.js", () => {
  return {
    db: {
      service: {
        findMany: vi.fn(),
      },
      requestLog: {
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

describe("Analytics Module Integration", () => {
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

  describe("GET /api/v1/analytics/overview", () => {
    it("should return aggregated metrics for the user's services", async () => {
      // Mock user services
      vi.mocked(db.service.findMany).mockResolvedValueOnce([
        { id: serviceId, name: "Billing API", slug: "billing-api" } as any,
      ]);

      // Mock overview aggregations:
      // totalRequests (100)
      vi.mocked(db.requestLog.count).mockResolvedValueOnce(100);
      // errorRequests (5)
      vi.mocked(db.requestLog.count).mockResolvedValueOnce(5);
      // latencyStats
      vi.mocked(db.requestLog.aggregate).mockResolvedValueOnce({
        _avg: { latencyMs: 45.2 },
        _min: { latencyMs: 12 },
        _max: { latencyMs: 310 },
      } as any);
      // statusCounts
      vi.mocked(db.requestLog.groupBy).mockResolvedValueOnce([
        { statusCode: 200, _count: { statusCode: 95 } },
        { statusCode: 500, _count: { statusCode: 5 } },
      ] as any);
      // failureCounts
      vi.mocked(db.requestLog.groupBy).mockResolvedValueOnce([
        { failureCategory: "UPSTREAM_ERROR", _count: { failureCategory: 5 } },
      ] as any);
      // serviceCounts
      vi.mocked(db.requestLog.groupBy).mockResolvedValueOnce([
        { serviceId, _count: { serviceId: 100 } },
      ] as any);
      // logsForBuckets
      vi.mocked(db.requestLog.findMany).mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/overview?timeRange=24h")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalRequests).toBe(100);
      expect(res.body.successfulRequests).toBe(95);
      expect(res.body.errorRequests).toBe(5);
      expect(res.body.errorRate).toBe(5); // 5%
      expect(res.body.latency.avg).toBe(45);
      expect(res.body.statusBreakdown).toHaveLength(2);
      expect(res.body.topServices[0].slug).toBe("billing-api");
      expect(res.body.timeSeries.length).toBeGreaterThan(0);
    });

    it("should return empty metrics gracefully when user has no registered services", async () => {
      vi.mocked(db.service.findMany).mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/v1/analytics/overview")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalRequests).toBe(0);
      expect(res.body.errorRate).toBe(0);
    });

    it("should reject requests without authorization token", async () => {
      const res = await request(app).get("/api/v1/analytics/overview");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/analytics/logs", () => {
    it("should return paginated request logs with enriched relations", async () => {
      vi.mocked(db.service.findMany).mockResolvedValueOnce([
        { id: serviceId } as any,
      ]);

      vi.mocked(db.requestLog.count).mockResolvedValueOnce(1);
      vi.mocked(db.requestLog.findMany).mockResolvedValueOnce([
        {
          id: "log-1",
          method: "GET",
          path: "/gateway/billing-api/charge",
          statusCode: 200,
          latencyMs: 38,
          clientIp: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          failureCategory: null,
          errorMessage: null,
          timestamp: new Date(),
          service: { id: serviceId, name: "Billing API", slug: "billing-api" },
          apiKey: { id: "key-1", name: "Web App", keyPrefix: "tr_live_a1b2c3d4" },
        } as any,
      ]);

      const res = await request(app)
        .get("/api/v1/analytics/logs?page=1&limit=10")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.logs).toHaveLength(1);
      expect(res.body.pagination).toMatchObject({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(res.body.logs[0].service.slug).toBe("billing-api");
    });
  });
});
