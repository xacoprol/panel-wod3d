import { neon } from "@neondatabase/serverless";

/** Consulta HTTP a Neon (siempre funciona en Vercel; no usa TCP 5432). */
export function neonSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export async function wakeNeon() {
  const sql = neonSql();
  await sql`SELECT 1`;
}
