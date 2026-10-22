import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on("connect", () => {
  console.log(" Connected to Redis");
});

redis.on("error", (err) => {
  // Non-fatal logging to prevent gateway process crashes if Redis is reconnecting
  console.error("⚠️ Redis connection error:", err.message);
});
