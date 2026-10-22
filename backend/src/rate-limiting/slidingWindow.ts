import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import crypto from "node:crypto";

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  failedOpen?: boolean;
}

// Atomic Redis Lua Script for Rolling Sliding Window
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

-- 1. Purge requests outside the sliding window
local clearBefore = now - window
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- 2. Count requests in active window
local currentRequests = redis.call('ZCARD', key)

if currentRequests < limit then
  -- Allowed: add member with score = current timestamp
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window + 1000)
  return { 1, limit - currentRequests - 1, math.ceil(window / 1000) }
else
  -- Denied: compute time until oldest request in window expires
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetSeconds = 1
  if #oldest > 0 then
    local oldestTime = tonumber(oldest[2])
    local resetMs = (oldestTime + window) - now
    if resetMs > 0 then
      resetSeconds = math.ceil(resetMs / 1000)
    end
  end
  return { 0, 0, resetSeconds }
end
`;

/**
 * Checks and updates sliding window rate limits atomically via Redis.
 */
export async function checkRateLimit(
  keyIdentifier: string,
  config: RateLimitConfig,
  failOpen = true
): Promise<RateLimitResult> {
  const now = Date.now();
  const redisKey = `ratelimit:${keyIdentifier}`;
  const uniqueMember = `${now}-${crypto.randomBytes(4).toString("hex")}`;

  try {
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      now.toString(),
      config.windowMs.toString(),
      config.limit.toString(),
      uniqueMember
    )) as [number, number, number];

    const [allowedFlag, remaining, resetSeconds] = result;

    return {
      allowed: allowedFlag === 1,
      limit: config.limit,
      remaining: Math.max(0, remaining),
      resetSeconds: Math.max(1, resetSeconds),
    };
  } catch (err: any) {
    logger.warn("Redis rate limiter error, applying fail policy", {
      keyIdentifier,
      error: err.message,
      failOpen,
    });

    if (failOpen) {
      // Fail-open: allow request to proceed to avoid gateway outage during cache failure
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        resetSeconds: Math.ceil(config.windowMs / 1000),
        failedOpen: true,
      };
    }

    // Fail-closed: reject request if Redis is down
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetSeconds: Math.ceil(config.windowMs / 1000),
      failedOpen: false,
    };
  }
}
