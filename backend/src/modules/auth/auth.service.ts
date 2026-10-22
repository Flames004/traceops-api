import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../lib/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { RegisterInput, LoginInput } from "./auth.schemas.js";

const SALT_ROUNDS = 10;

export async function register(input: RegisterInput) {
  const existingUser = await db.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new AppError("An account with this email address already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  return { user, token };
}

export async function login(input: LoginInput) {
  const user = await db.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
}

export async function getProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
}
