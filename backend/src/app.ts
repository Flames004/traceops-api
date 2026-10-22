import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: "*", // Will be restricted to frontend URL in production
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    })
  );

  // Body parsers with configured limit
  app.use(express.json({ limit: env.GATEWAY_MAX_BODY_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: env.GATEWAY_MAX_BODY_SIZE }));

  // Liveness / Readiness health check
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "TraceOpsAPI",
    });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
