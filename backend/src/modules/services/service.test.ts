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
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

describe("Service Management Integration", () => {
  const app = createApp();
  const userId = "user-123";
  const validToken = jwt.sign(
    { userId, email: "admin@traceops.io", role: "ADMIN" },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/services", () => {
    it("should reject requests without authorization token", async () => {
      const res = await request(app).post("/api/v1/services").send({
        name: "Payment API",
        slug: "payment-api",
        upstreamUrl: "https://api.stripe.com",
      });

      expect(res.status).toBe(401);
    });

    it("should reject SSRF target: AWS metadata IP 169.254.169.254", async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "AWS Exploit",
          slug: "aws-exploit",
          upstreamUrl: "http://169.254.169.254/latest/meta-data",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("SSRF Security Error");
    });

    it("should reject SSRF target: localhost loopback", async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "Local Service",
          slug: "local-service",
          upstreamUrl: "http://127.0.0.1:8080",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("SSRF Security Error");
    });

    it("should create a service with valid public upstream URL", async () => {
      vi.mocked(db.service.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.service.create).mockResolvedValueOnce({
        id: "serv-1",
        name: "GitHub API",
        slug: "github-api",
        description: "Public GitHub API",
        upstreamUrl: "https://api.github.com",
        routePrefix: "/v1",
        isActive: true,
        timeoutMs: 5000,
        allowedMethods: ["GET", "POST"],
        rateLimitMax: 60,
        rateLimitWindowMs: 60000,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "GitHub API",
          slug: "github-api",
          description: "Public GitHub API",
          upstreamUrl: "https://api.github.com",
          routePrefix: "/v1",
        });

      expect(res.status).toBe(201);
      expect(res.body.service).toHaveProperty("id", "serv-1");
      expect(res.body.service.slug).toBe("github-api");
    }, 15000);

    it("should return 409 if service slug already exists", async () => {
      vi.mocked(db.service.findUnique).mockResolvedValueOnce({
        id: "existing-serv",
        slug: "github-api",
      } as any);

      const res = await request(app)
        .post("/api/v1/services")
        .set("Authorization", `Bearer ${validToken}`)
        .send({
          name: "GitHub API Duplicate",
          slug: "github-api",
          upstreamUrl: "https://api.github.com",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already exists");
    });
  });

  describe("GET /api/v1/services", () => {
    it("should list services for authenticated user", async () => {
      vi.mocked(db.service.findMany).mockResolvedValueOnce([
        {
          id: "serv-1",
          name: "Service 1",
          slug: "service-1",
          upstreamUrl: "https://example.com",
          isActive: true,
          _count: { apiKeys: 2, requestLogs: 100 },
        } as any,
      ]);

      const res = await request(app)
        .get("/api/v1/services")
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.services).toHaveLength(1);
      expect(res.body.count).toBe(1);
    });
  });

  describe("PATCH /api/v1/services/:id/toggle", () => {
    it("should toggle service isActive status", async () => {
      const serviceId = "00000000-0000-0000-0000-000000000001";
      vi.mocked(db.service.findFirst).mockResolvedValueOnce({
        id: serviceId,
        userId,
        isActive: true,
      } as any);
      vi.mocked(db.service.update).mockResolvedValueOnce({
        id: serviceId,
        isActive: false,
      } as any);

      const res = await request(app)
        .patch(`/api/v1/services/${serviceId}/toggle`)
        .set("Authorization", `Bearer ${validToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("disabled");
    });
  });

  describe("DELETE /api/v1/services/:id", () => {
    it("should delete existing service", async () => {
      const serviceId = "00000000-0000-0000-0000-000000000001";
      vi.mocked(db.service.findFirst).mockResolvedValueOnce({
        id: serviceId,
        userId,
      } as any);
      vi.mocked(db.service.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete(`/api/v1/services/${serviceId}`)
        .set("Authorization", `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("deleted successfully");
    });
  });
});
