import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation Error",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Handle Operational App Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unhandled / Internal Server Errors
  logger.error("Unhandled Error", err, { path: req.path, method: req.method });

  res.status(500).json({
    error: "Internal Server Error",
    ...(env.NODE_ENV === "development" ? { message: err.message, stack: err.stack } : {}),
  });
}
