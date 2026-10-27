import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { serviceRoutes } from "./modules/services/service.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { gatewayRouter } from "./gateway/router.js";

export function createApp(): Express {
  const app = express();

  // Security headers with cross-origin resource policy enabled
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // Robust CORS configuration for cloud deployments
  app.use(
    cors({
      origin: "*", // Allows requests from Vercel, localhost, or any client
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "Accept", "Origin", "X-Requested-With"],
      exposedHeaders: [
        "X-Gateway-Request-Id",
        "X-Gateway-Latency-Ms",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "Retry-After",
      ],
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

  // Control Plane APIs (Management)
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/services", serviceRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);

  // Data Plane API Gateway (Runtime reverse proxy)
  app.use("/gateway", gatewayRouter);

  // Central error handler
  app.use(errorHandler);

  return app;
}
