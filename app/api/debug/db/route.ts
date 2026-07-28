import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { neonSql, wakeNeon } from "@/lib/neon-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnóstico Neon HTTP. Requiere Authorization: Bearer $CRON_SECRET */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    host = "(invalid DATABASE_URL)";
  }

  const out: Record<string, unknown> = {
    hasDatabaseUrl: Boolean(raw),
    host,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    authUrl: process.env.AUTH_URL ?? null,
  };

  try {
    await wakeNeon();
    out.wake = "ok";
  } catch (e) {
    out.wake = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }

  try {
    const sql = neonSql();
    const rows = await sql`
      SELECT id, email, name, "passwordHash"
      FROM "User"
      WHERE email = ${"admin@factura.local"}
      LIMIT 1
    `;
    const user = rows[0] as
      | { id: string; email: string; name: string | null; passwordHash: string }
      | undefined;
    out.userFound = Boolean(user);
    out.userEmail = user?.email ?? null;
    if (user?.passwordHash) {
      out.passwordOk = await bcrypt.compare("admin123", user.passwordHash);
      out.hashPrefix = user.passwordHash.slice(0, 10);
    } else {
      out.passwordOk = false;
    }

    const count = await sql`SELECT COUNT(*)::int AS n FROM "User"`;
    out.userCount = (count[0] as { n: number })?.n ?? null;
  } catch (e) {
    out.queryError = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }

  return NextResponse.json(out);
}
