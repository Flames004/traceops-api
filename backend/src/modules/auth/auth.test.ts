import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../app.js";
import { db } from "../../lib/db.js";

vi.mock("../../lib/db.js", () => {
  return {
    db: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

describe("Auth Module Integration", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a new user", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.user.create).mockResolvedValueOnce({
        id: "user-123",
        email: "alice@example.com",
        name: "Alice",
        role: "ADMIN",
        passwordHash: "hashed",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).post("/api/v1/auth/register").send({
        email: "alice@example.com",
        password: "securePassword123!",
        name: "Alice",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user).toMatchObject({
        id: "user-123",
        email: "alice@example.com",
        name: "Alice",
      });
    });

    it("should return 409 if email already exists", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "user-existing",
        email: "alice@example.com",
      } as any);

      const res = await request(app).post("/api/v1/auth/register").send({
        email: "alice@example.com",
        password: "securePassword123!",
        name: "Alice",
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already exists");
    });

    it("should return 400 for invalid email or weak password", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "not-an-email",
        password: "123",
        name: "A",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation Error");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should login with valid credentials and return JWT", async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "user-123",
        email: "alice@example.com",
        name: "Alice",
        role: "ADMIN",
        passwordHash: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "alice@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe("alice@example.com");
    });

    it("should return 401 for incorrect password", async () => {
      const hashedPassword = await bcrypt.hash("correct-password", 10);
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "user-123",
        email: "alice@example.com",
        passwordHash: hashedPassword,
      } as any);

      const res = await request(app).post("/api/v1/auth/login").send({
        email: "alice@example.com",
        password: "wrong-password",
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid email or password");
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
    });

    it("should return profile with valid Bearer token", async () => {
      // First get a valid token via login mock
      const hashedPassword = await bcrypt.hash("password123", 10);
      vi.mocked(db.user.findUnique)
        .mockResolvedValueOnce({
          id: "user-123",
          email: "alice@example.com",
          name: "Alice",
          role: "ADMIN",
          passwordHash: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: "user-123",
          email: "alice@example.com",
          name: "Alice",
          role: "ADMIN",
          createdAt: new Date(),
        } as any);

      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: "alice@example.com",
        password: "password123",
      });

      const token = loginRes.body.token;

      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe("alice@example.com");
    });
  });
});
