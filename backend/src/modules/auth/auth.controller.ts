import { Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./auth.schemas.js";
import * as authService from "./auth.service.js";

export async function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json({
      message: "User registered successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function handleGetProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.status(200).json({
      user: profile,
    });
  } catch (err) {
    next(err);
  }
}
