/**
 * Import presupuestos from listado_presupuestos_*.xls
 * Usage: npx tsx scripts/import-quotes.ts [path-to-xls]
 *
 * El listado no trae líneas: se crea una línea única con el total
 * (IVA 0%) para que el importe coincida exactamente con el Excel.
 * Los números originales (W3D…, PR25/…) se conservan en fullNumber.
 */
import path from "path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

function excelDateToJs(value: unknown): Date {
  if (typeof value === "number") {
    // Excel serial date (UTC)
    const utc = (value - 25569) * 86400 * 1000;
    return new Date(utc);
  }
  return new Date(String(value));
}

function clean(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapStatus(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("factur")) return "ACEPTADO";
  if (s.includes("acept")) return "ACEPTADO";
  if (s.includes("rechaz")) return "RECHAZADO";
  if (s.includes("expir")) return "EXPIRADO";
  if (s.includes("borrador")) return "BORRADOR";
  // Pendiente → enviado / a la espera
  return "ENVIADO";
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function findOrCreateClient(name: string, pendingCounter: { n: number }) {
  const clients = await prisma.client.findMany({
    select: { id: true, name: true },
  });
  const target = normalizeName(name);
  const match = clients.find((c) => normalizeName(c.name) === target);
  if (match) return match.id;

  // Partial contains match (e.g. slight spacing differences)
  const loose = clients.find(
    (c) =>
      normalizeName(c.name).includes(target) ||
      target.includes(normalizeName(c.name))
  );
  if (loose) return loose.id;

  pendingCounter.n += 1;
  const nif = `PEND-Q${String(pendingCounter.n).padStart(3, "0")}`;
  const created = await prisma.client.create({
    data: {
      name,
      nif,
      addressStreet: "Sin dirección",
      addressCity: "—",
      addressProvince: "—",
      addressZip: "00000",
      addressCountry: "España",
      notes:
        "⚠️ Cliente creado automáticamente al importar presupuestos (completar datos fiscales)",
    },
  });
  console.log(`  + cliente nuevo: ${name} (${nif})`);
  return created.id;
}

async function main() {
  const file =
    process.argv[2] ||
    path.join(
      process.env.HOME || "",
      "Downloads/listado_presupuestos_28072026.xls"
    );

  const wb = XLSX.readFile(file);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(
    wb.Sheets[wb.SheetNames[0]],
    { header: 1, defval: "" }
  );

  let start = rows.findIndex(
    (r) => clean(r[0]).toUpperCase() === "CLIENTE"
  );
  if (start < 0) start = 4;
  else start += 1;

  const items = rows
    .slice(start)
    .map((r) => ({
      clientName: clean(r[0]),
      issueDate: excelDateToJs(r[1]),
      fullNumber: clean(r[2]),
      total: Number(r[3]) || 0,
      status: mapStatus(clean(r[4])),
    }))
    .filter((q) => q.clientName && q.fullNumber);

  console.log(`Presupuestos a importar: ${items.length}`);

  const series = await prisma.quoteSeries.findFirstOrThrow({
    where: { isDefault: true },
  });

  const pendingCounter = { n: 0 };
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await prisma.quote.findFirst({
      where: { fullNumber: item.fullNumber },
    });
    if (existing) {
      console.log(`  skip (ya existe): ${item.fullNumber}`);
      skipped++;
      continue;
    }

    const clientId = await findOrCreateClient(item.clientName, pendingCounter);

    // Reserve correlative slot without changing displayed fullNumber
    const number = series.nextNumber + created;
    const validUntil = new Date(item.issueDate);
    validUntil.setDate(validUntil.getDate() + 30);

    // Una línea: total exacto del Excel (sin desglose IVA disponible)
    await prisma.quote.create({
      data: {
        seriesId: series.id,
        seriesPrefix: series.prefix,
        number,
        fullNumber: item.fullNumber,
        clientId,
        issueDate: item.issueDate,
        validUntil,
        status: item.status,
        notes:
          "Importado desde listado Excel. Sin desglose de líneas/IVA — importe global conservado.",
        conditions: null,
        subtotal: item.total,
        vatAmount: 0,
        total: item.total,
        lines: {
          create: [
            {
              sortOrder: 0,
              description:
                "Concepto importado (detalle de líneas no disponible en el listado)",
              quantity: 1,
              unitPrice: item.total,
              vatRate: 0,
              discountPct: 0,
              lineSubtotal: item.total,
              lineVat: 0,
              lineTotal: item.total,
            },
          ],
        },
      },
    });

    created++;
    console.log(
      `  + ${item.fullNumber} · ${item.clientName} · ${item.total}€ · ${item.status}`
    );
  }

  if (created > 0) {
    await prisma.quoteSeries.update({
      where: { id: series.id },
      data: { nextNumber: series.nextNumber + created },
    });
  }

  console.log(`\nImportados: ${created} | Omitidos: ${skipped}`);
  console.log(
    `Clientes nuevos creados por el import: ${pendingCounter.n}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
