import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "./slidingWindow.js";
import { redis } from "../lib/redis.js";

vi.mock("../lib/redis.js", () => {
  return {
    redis: {
      eval: vi.fn(),
    },
  };
});

describe("Atomic Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should permit requests within limit and return accurate remaining count", async () => {
    // Mock Redis Lua returning [allowed (1), remaining (4), resetSeconds (60)]
    vi.mocked(redis.eval).mockResolvedValueOnce([1, 4, 60]);

    const result = await checkRateLimit("key-1", { limit: 5, windowMs: 60000 });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(4);
    expect(result.resetSeconds).toBe(60);
  });

  it("should reject requests exceeding limit with 0 remaining", async () => {
    // Mock Redis Lua returning [denied (0), remaining (0), resetSeconds (12)]
    vi.mocked(redis.eval).mockResolvedValueOnce([0, 0, 12]);

    const result = await checkRateLimit("key-1", { limit: 5, windowMs: 60000 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetSeconds).toBe(12);
  });

  it("should fail-open gracefully when Redis throws an exception", async () => {
    vi.mocked(redis.eval).mockRejectedValueOnce(new Error("Redis connection timed out"));

    const result = await checkRateLimit("key-1", { limit: 10, windowMs: 60000 }, true);

    expect(result.allowed).toBe(true);
    expect(result.failedOpen).toBe(true);
    expect(result.limit).toBe(10);
  });

  it("should fail-closed when failOpen is explicitly false and Redis throws an exception", async () => {
    vi.mocked(redis.eval).mockRejectedValueOnce(new Error("Redis connection timed out"));

    const result = await checkRateLimit("key-1", { limit: 10, windowMs: 60000 }, false);

    expect(result.allowed).toBe(false);
    expect(result.failedOpen).toBe(false);
  });
});
