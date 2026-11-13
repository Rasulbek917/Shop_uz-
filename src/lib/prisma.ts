import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function databaseUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured || !process.env.VERCEL) return configured;
  const url = new URL(configured);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
  if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
  return url.toString();
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: databaseUrl() } },
  transactionOptions: { maxWait: 10000, timeout: 20000 },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

globalForPrisma.prisma = prisma;
