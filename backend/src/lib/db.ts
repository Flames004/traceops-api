import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
} & typeof global;

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
}
