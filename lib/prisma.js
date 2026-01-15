import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

/**
 * Prevent multiple Prisma instances in development
 * DO NOT disconnect the client manually
 */
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
