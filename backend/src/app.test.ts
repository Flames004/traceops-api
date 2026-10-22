import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

describe("Gateway Base App", () => {
  const app = createApp();

  it("GET /health should return 200 OK with system status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "healthy");
    expect(res.body).toHaveProperty("service", "TraceOpsAPI");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
  });

  it("should include security headers from Helmet", async () => {
    const res = await request(app).get("/health");

    expect(res.headers).toHaveProperty("x-dns-prefetch-control");
    expect(res.headers).toHaveProperty("x-content-type-options", "nosniff");
  });
});
