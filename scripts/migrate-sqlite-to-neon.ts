/**
 * One-off: copia datos de prisma/dev.db (SQLite local) → Neon (DATABASE_URL).
 * Conserva IDs y relaciones. No toca User (mantiene logins de producción).
 *
 * Usage: npx tsx scripts/migrate-sqlite-to-neon.ts
 */
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function sqliteJson(sql: string): Record<string, unknown>[] {
  const db = path.join(process.cwd(), "prisma/dev.db");
  const out = execFileSync("sqlite3", ["-json", db, sql], {
    encoding: "utf8",
  }).trim();
  if (!out) return [];
  return JSON.parse(out) as Record<string, unknown>[];
}

function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Prisma/SQLite a veces guarda epoch ms
    if (v > 1e12) return new Date(v);
    if (v > 1e9) return new Date(v * 1000);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1" || v === "true";
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function toStrOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    throw new Error("DATABASE_URL inválida (debe ser postgresql://…)");
  }
  const sql = neon(url);

  console.log("Leyendo SQLite…");
  const settings = sqliteJson("SELECT * FROM CompanySettings");
  const invoiceSeries = sqliteJson("SELECT * FROM InvoiceSeries");
  const quoteSeries = sqliteJson("SELECT * FROM QuoteSeries");
  const clients = sqliteJson("SELECT * FROM Client");
  const quotes = sqliteJson("SELECT * FROM Quote");
  const quoteLines = sqliteJson("SELECT * FROM QuoteLine ORDER BY sortOrder");
  const templates = sqliteJson("SELECT * FROM RecurringInvoiceTemplate");
  const templateLines = sqliteJson(
    "SELECT * FROM RecurringLine ORDER BY sortOrder"
  );

  console.log({
    settings: settings.length,
    invoiceSeries: invoiceSeries.length,
    quoteSeries: quoteSeries.length,
    clients: clients.length,
    quotes: quotes.length,
    quoteLines: quoteLines.length,
    templates: templates.length,
    templateLines: templateLines.length,
  });

  console.log("Limpiando tablas de negocio en Neon (se conservan User)…");
  // Orden por FKs
  await sql`DELETE FROM "RecurringLine"`;
  await sql`DELETE FROM "RecurringInvoiceTemplate"`;
  await sql`DELETE FROM "QuoteLine"`;
  await sql`DELETE FROM "InvoiceLine"`;
  await sql`DELETE FROM "Invoice"`;
  await sql`DELETE FROM "Quote"`;
  await sql`DELETE FROM "Client"`;
  await sql`DELETE FROM "InvoiceSeries"`;
  await sql`DELETE FROM "QuoteSeries"`;
  await sql`DELETE FROM "CompanySettings"`;
  await sql`DELETE FROM "CronRunLog"`;

  console.log("Insertando CompanySettings…");
  for (const s of settings) {
    await sql`
      INSERT INTO "CompanySettings" (
        id, name, nif, "addressStreet", "addressCity", "addressProvince", "addressZip",
        "addressCountry", email, phone, "logoUrl", "defaultVatRate", "defaultIrpfRate",
        "emailSubject", "emailBody", "bankIban", "bankName",
        "themeBg", "themeBgElevated", "themeInk", "themeInkMuted", "themeLine",
        "themeAccent", "themeAccentHover", "themeAccentSoft", "themeSidebar", "themeSidebarText",
        "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(s.id)}, ${toStr(s.name)}, ${toStr(s.nif)},
        ${toStr(s.addressStreet)}, ${toStr(s.addressCity)}, ${toStr(s.addressProvince)},
        ${toStr(s.addressZip)}, ${toStr(s.addressCountry, "España")},
        ${toStr(s.email)}, ${toStr(s.phone)}, ${toStrOrNull(s.logoUrl)},
        ${toNum(s.defaultVatRate, 21)}, ${toNum(s.defaultIrpfRate, 15)},
        ${toStr(s.emailSubject)}, ${toStr(s.emailBody)},
        ${toStrOrNull(s.bankIban)}, ${toStrOrNull(s.bankName)},
        ${toStr(s.themeBg, "#f3efe6")}, ${toStr(s.themeBgElevated, "#faf7f0")},
        ${toStr(s.themeInk, "#1a2332")}, ${toStr(s.themeInkMuted, "#5c6b7a")},
        ${toStr(s.themeLine, "#d4cbb8")}, ${toStr(s.themeAccent, "#0d6e6e")},
        ${toStr(s.themeAccentHover, "#0a5858")}, ${toStr(s.themeAccentSoft, "#e0f0ef")},
        ${toStr(s.themeSidebar, "#1a2332")}, ${toStr(s.themeSidebarText, "#e8e4db")},
        ${toDate(s.createdAt) ?? new Date()}, ${toDate(s.updatedAt) ?? new Date()}
      )
    `;
  }

  console.log("Insertando series…");
  for (const s of invoiceSeries) {
    await sql`
      INSERT INTO "InvoiceSeries" (
        id, prefix, name, "nextNumber", year, "padLength", "isDefault", "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(s.id)}, ${toStr(s.prefix)}, ${toStr(s.name)},
        ${toNum(s.nextNumber, 1)}, ${s.year == null ? null : toNum(s.year)},
        ${toNum(s.padLength, 3)}, ${toBool(s.isDefault)},
        ${toDate(s.createdAt) ?? new Date()}, ${toDate(s.updatedAt) ?? new Date()}
      )
    `;
  }
  for (const s of quoteSeries) {
    await sql`
      INSERT INTO "QuoteSeries" (
        id, prefix, name, "nextNumber", year, "padLength", "isDefault", "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(s.id)}, ${toStr(s.prefix)}, ${toStr(s.name)},
        ${toNum(s.nextNumber, 1)}, ${s.year == null ? null : toNum(s.year)},
        ${toNum(s.padLength, 3)}, ${toBool(s.isDefault)},
        ${toDate(s.createdAt) ?? new Date()}, ${toDate(s.updatedAt) ?? new Date()}
      )
    `;
  }

  console.log(`Insertando ${clients.length} clientes…`);
  for (const c of clients) {
    await sql`
      INSERT INTO "Client" (
        id, name, nif, "countryCode", "addressStreet", "addressCity", "addressProvince",
        "addressZip", "addressCountry", email, phone, "contactPerson", notes, "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(c.id)}, ${toStr(c.name)}, ${toStr(c.nif)}, ${toStr(c.countryCode, "ES")},
        ${toStr(c.addressStreet)}, ${toStr(c.addressCity)}, ${toStr(c.addressProvince)},
        ${toStr(c.addressZip)}, ${toStr(c.addressCountry, "España")},
        ${toStrOrNull(c.email)}, ${toStrOrNull(c.phone)}, ${toStrOrNull(c.contactPerson)},
        ${toStrOrNull(c.notes)},
        ${toDate(c.createdAt) ?? new Date()}, ${toDate(c.updatedAt) ?? new Date()}
      )
    `;
  }

  console.log(`Insertando ${quotes.length} presupuestos…`);
  for (const q of quotes) {
    await sql`
      INSERT INTO "Quote" (
        id, "seriesId", "seriesPrefix", number, "fullNumber", "clientId",
        "issueDate", "validUntil", status, notes, conditions,
        subtotal, "vatAmount", total, "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(q.id)}, ${toStr(q.seriesId)}, ${toStr(q.seriesPrefix)},
        ${toNum(q.number)}, ${toStr(q.fullNumber)}, ${toStr(q.clientId)},
        ${toDate(q.issueDate) ?? new Date()}, ${toDate(q.validUntil)},
        ${toStr(q.status, "BORRADOR")}, ${toStrOrNull(q.notes)}, ${toStrOrNull(q.conditions)},
        ${toNum(q.subtotal)}, ${toNum(q.vatAmount)}, ${toNum(q.total)},
        ${toDate(q.createdAt) ?? new Date()}, ${toDate(q.updatedAt) ?? new Date()}
      )
    `;
  }

  console.log(`Insertando ${quoteLines.length} líneas de presupuesto…`);
  for (const l of quoteLines) {
    await sql`
      INSERT INTO "QuoteLine" (
        id, "quoteId", "sortOrder", description, quantity, "unitPrice",
        "vatRate", "discountPct", "lineSubtotal", "lineVat", "lineTotal"
      ) VALUES (
        ${toStr(l.id)}, ${toStr(l.quoteId)}, ${toNum(l.sortOrder)},
        ${toStr(l.description)}, ${toNum(l.quantity, 1)}, ${toNum(l.unitPrice)},
        ${toNum(l.vatRate)}, ${toNum(l.discountPct)},
        ${toNum(l.lineSubtotal)}, ${toNum(l.lineVat)}, ${toNum(l.lineTotal)}
      )
    `;
  }

  console.log(`Insertando ${templates.length} plantillas recurrentes…`);
  for (const t of templates) {
    await sql`
      INSERT INTO "RecurringInvoiceTemplate" (
        id, name, "clientId", "seriesId", frequency, "intervalCount", "dayOfMonth",
        "startDate", "endDate", status, notes, "paymentMethod", "bankIban",
        "irpfRate", "vatOperationType", "cashAccounting", "operationKey", "operationKey347",
        "nextRunDate", "lastRunAt", "createdAt", "updatedAt"
      ) VALUES (
        ${toStr(t.id)}, ${toStr(t.name)}, ${toStr(t.clientId)}, ${toStr(t.seriesId)},
        ${toStr(t.frequency)}, ${toNum(t.intervalCount, 1)}, ${toNum(t.dayOfMonth, 1)},
        ${toDate(t.startDate) ?? new Date()}, ${toDate(t.endDate)},
        ${toStr(t.status, "ACTIVA")}, ${toStrOrNull(t.notes)},
        ${toStrOrNull(t.paymentMethod)}, ${toStrOrNull(t.bankIban)},
        ${toNum(t.irpfRate)}, ${toStr(t.vatOperationType, "NACIONAL")},
        ${toBool(t.cashAccounting)}, ${toStrOrNull(t.operationKey)}, ${toStrOrNull(t.operationKey347)},
        ${toDate(t.nextRunDate)}, ${toDate(t.lastRunAt)},
        ${toDate(t.createdAt) ?? new Date()}, ${toDate(t.updatedAt) ?? new Date()}
      )
    `;
  }

  console.log(`Insertando ${templateLines.length} líneas recurrentes…`);
  for (const l of templateLines) {
    await sql`
      INSERT INTO "RecurringLine" (
        id, "templateId", "sortOrder", description, quantity, "unitPrice",
        "vatRate", "discountPct"
      ) VALUES (
        ${toStr(l.id)}, ${toStr(l.templateId)}, ${toNum(l.sortOrder)},
        ${toStr(l.description)}, ${toNum(l.quantity, 1)}, ${toNum(l.unitPrice)},
        ${toNum(l.vatRate)}, ${toNum(l.discountPct)}
      )
    `;
  }

  const c = await sql`SELECT COUNT(*)::int AS n FROM "Client"`;
  const q = await sql`SELECT COUNT(*)::int AS n FROM "Quote"`;
  const is_ = await sql`SELECT prefix, "nextNumber", "padLength" FROM "InvoiceSeries"`;
  const qs = await sql`SELECT prefix, "nextNumber", "padLength" FROM "QuoteSeries"`;
  const st = await sql`SELECT name, nif FROM "CompanySettings"`;

  console.log("Migración OK");
  console.log({
    clients: c[0].n,
    quotes: q[0].n,
    invoiceSeries: is_,
    quoteSeries: qs,
    company: st[0],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
