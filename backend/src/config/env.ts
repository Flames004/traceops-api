import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters long").default("traceops_dev_secret_change_in_production_key_12345"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DATABASE_URL: z.string().url().default("postgresql://traceops_user:traceops_password@localhost:5432/traceops_db?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  GATEWAY_DEFAULT_TIMEOUT_MS: z.coerce.number().default(5000),
  GATEWAY_MAX_BODY_SIZE: z.string().default("10mb"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment configuration");
}

export const env = parsedEnv.data;
