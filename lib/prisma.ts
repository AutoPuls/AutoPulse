import { PrismaClient } from "@prisma/client";

// The simplest, most standard way to init Prisma.
// If this fails, the Vercel logs will show the ACTUAL error.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Log presence of URL (but not the URL itself for safety)
if (!process.env.DATABASE_URL) {
  console.error("CRITICAL: DATABASE_URL is missing from environment!");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
