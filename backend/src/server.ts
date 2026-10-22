import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { db } from "./lib/db.js";
import { redis } from "./lib/redis.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 TraceOpsAPI Gateway running on port ${env.PORT} [${env.NODE_ENV}]`);
});

// Graceful Shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    server.close(async () => {
      logger.info("HTTP server closed.");

      try {
        await db.$disconnect();
        logger.info("Database disconnected.");
      } catch (err) {
        logger.error("Error disconnecting database", err);
      }

      try {
        await redis.quit();
        logger.info("Redis disconnected.");
      } catch (err) {
        logger.error("Error disconnecting Redis", err);
      }

      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      logger.error("Forceful shutdown after timeout.");
      process.exit(1);
    }, 10000);
  });
}
