/**
 * Valida el caso Ritmos: cron simulado en 2026-06-01 genera factura exenta 90€.
 * Usage: npx tsx scripts/test-ritmos-cron.ts
 */
import { PrismaClient } from "@prisma/client";
import { calculateDocument } from "../lib/calculations";
import { allocateInvoiceNumber } from "../lib/numbering";
import { advanceDate, type Frequency } from "../lib/recurring";

const prisma = new PrismaClient();

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const asOfKey = "2026-06-01";

  const candidates = await prisma.recurringInvoiceTemplate.findMany({
    where: { status: "ACTIVA", name: { contains: "bellux" }, nextRunDate: { not: null } },
    include: { lines: { orderBy: { sortOrder: "asc" } }, client: true },
  });

  const tpl = candidates.find(
    (t) => t.nextRunDate && dayKey(t.nextRunDate) <= asOfKey
  );

  if (!tpl) {
    throw new Error(
      "Plantilla bellux no encontrada o nextRunDate > 2026-06-01. Ejecuta el seed."
    );
  }

  console.log("Plantilla:", tpl.name);
  console.log("  cliente:", tpl.client.name, tpl.client.nif, tpl.client.countryCode);
  console.log("  nextRun:", dayKey(tpl.nextRunDate!));
  console.log("  vatOp:", tpl.vatOperationType, "cash:", tpl.cashAccounting);

  const lineInputs = tpl.lines.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    vatRate: 0,
    discountPct: l.discountPct,
  }));
  const totals = calculateDocument(lineInputs, tpl.irpfRate);
  console.log("Totales calculados:", {
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
  });

  if (totals.subtotal !== 90 || totals.vatAmount !== 0 || totals.total !== 90) {
    throw new Error(
      `Totales incorrectos: esperado 90/0/90, got ${totals.subtotal}/${totals.vatAmount}/${totals.total}`
    );
  }

  const existing = await prisma.invoice.findFirst({
    where: { recurringTemplateId: tpl.id },
    orderBy: { issueDate: "desc" },
  });
  if (existing && dayKey(existing.issueDate) === "2026-06-01") {
    console.log("Factura ya existía:", existing.fullNumber);
    console.log(
      "  base",
      Number(existing.subtotal),
      "IVA",
      Number(existing.vatAmount),
      "total",
      Number(existing.total)
    );
    console.log("OK ✓");
    return;
  }

  const issueDate = new Date(2026, 5, 1, 12, 0, 0, 0);
  const invoice = await prisma.$transaction(async (tx) => {
    const num = await allocateInvoiceNumber(tx, tpl.seriesId);
    const inv = await tx.invoice.create({
      data: {
        seriesId: num.seriesId,
        seriesPrefix: num.seriesPrefix,
        number: num.number,
        fullNumber: num.fullNumber,
        clientId: tpl.clientId,
        issueDate,
        dueDate: new Date(2026, 6, 1, 12),
        status: "PENDIENTE",
        paymentMethod: tpl.paymentMethod,
        notes: tpl.notes,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        irpfRate: 0,
        irpfAmount: 0,
        total: totals.total,
        vatOperationType: tpl.vatOperationType,
        cashAccounting: tpl.cashAccounting,
        operationKey: tpl.operationKey,
        operationKey347: tpl.operationKey347,
        recurringTemplateId: tpl.id,
        lines: {
          create: totals.lines.map((l) => ({
            sortOrder: l.sortOrder,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            vatRate: l.vatRate,
            discountPct: l.discountPct,
            lineSubtotal: l.lineSubtotal,
            lineVat: l.lineVat,
            lineTotal: l.lineTotal,
          })),
        },
      },
    });

    const nextRun = advanceDate(
      issueDate,
      tpl.frequency as Frequency,
      tpl.dayOfMonth,
      tpl.intervalCount
    );
    await tx.recurringInvoiceTemplate.update({
      where: { id: tpl.id },
      data: { lastRunAt: new Date(), nextRunDate: nextRun },
    });
    return inv;
  });

  const updated = await prisma.recurringInvoiceTemplate.findUnique({
    where: { id: tpl.id },
  });

  console.log("Factura generada:", invoice.fullNumber);
  console.log(
    "  base",
    Number(invoice.subtotal),
    "IVA",
    Number(invoice.vatAmount),
    "total",
    Number(invoice.total)
  );
  console.log("  vatOperationType", invoice.vatOperationType);
  console.log("  recurringTemplateId", invoice.recurringTemplateId);
  console.log("  nextRun avanzado a", dayKey(updated!.nextRunDate!));
  if (dayKey(updated!.nextRunDate!) !== "2027-06-01") {
    throw new Error(`nextRun esperado 2027-06-01, got ${dayKey(updated!.nextRunDate!)}`);
  }
  console.log("OK ✓ caso Ritmos validado");
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
