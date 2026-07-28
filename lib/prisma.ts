import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

/**
 * Neon + Vercel: no usar TCP :5432 desde serverless (falla con P1001).
 * El adapter habla por WebSocket (443) con el pooler.
 */
neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withNeonParams(url: string): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    // PgBouncer / pooler de Neon
    if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "30");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function createPrismaClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return new PrismaClient();
  }

  const connectionString = withNeonParams(raw);
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
