import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4, // Heavily restricted to avoid pooler exhaust
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 60000, // Increase timeout to 60s for stability
  });

  pool.on('error', (err) => {
    console.error('[db-pool] Unexpected error on idle client:', err.message);
  });

  pool.on('connect', () => {
    console.log('[db-pool] Low-level client connected to database');
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: ["error"], // Keep logs clean
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
