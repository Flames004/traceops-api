import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";
import { AuthUser } from "../types/express.js";

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("Authentication required. Please provide a Bearer token.", 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("Authentication token has expired. Please log in again.", 401);
    }
    throw new AppError("Invalid authentication token.", 401);
  }
}
