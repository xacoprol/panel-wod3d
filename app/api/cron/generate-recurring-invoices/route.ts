import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDocument } from "@/lib/calculations";
import { allocateInvoiceNumber } from "@/lib/numbering";
import { advanceDate, type Frequency } from "@/lib/recurring";
import { parseISO, isValid } from "date-fns";

/** Clave de día local YYYY-MM-DD (evita desfases UTC en comparaciones) */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localNoonFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Genera como máximo UNA factura por plantilla y ejecución.
 * Plantillas con fechaHasta lejana (p.ej. 2040) no pregeneran nada:
 * solo avanzan nextRunDate un ciclo tras emitir.
 *
 * Query opcional: ?date=2026-06-01 para simular el día de ejecución.
 */
async function runGeneration(asOf: Date) {
  const log = await prisma.cronRunLog.create({
    data: { success: false },
  });

  const asOfKey = dayKey(asOf);
  const details: {
    templateId: string;
    name: string;
    invoiceId?: string;
    fullNumber?: string;
    subtotal?: number;
    vatAmount?: number;
    total?: number;
    error?: string;
  }[] = [];

  let invoicesCreated = 0;

  try {
    const candidates = await prisma.recurringInvoiceTemplate.findMany({
      where: {
        status: "ACTIVA",
        nextRunDate: { not: null },
      },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    const templates = candidates.filter((tpl) => {
      if (!tpl.nextRunDate) return false;
      if (dayKey(tpl.nextRunDate) > asOfKey) return false;
      if (tpl.endDate && dayKey(tpl.endDate) < asOfKey) return false;
      return true;
    });

    for (const tpl of templates) {
      try {
        const forceZeroVat =
          tpl.vatOperationType === "EXENTA" ||
          tpl.vatOperationType === "INTRACOMUNITARIA" ||
          tpl.vatOperationType === "EXPORTACION";

        const lineInputs = tpl.lines.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          vatRate: forceZeroVat ? 0 : l.vatRate,
          discountPct: l.discountPct,
        }));
        const totals = calculateDocument(lineInputs, tpl.irpfRate);
        const issueDate = localNoonFromKey(dayKey(tpl.nextRunDate!));
        const due = new Date(issueDate);
        due.setDate(due.getDate() + 30);

        const num = await allocateInvoiceNumber(prisma, tpl.seriesId);
        const lastInSeries = await prisma.invoice.findFirst({
          where: { seriesId: num.seriesId },
          orderBy: { number: "desc" },
        });

        const invoice = await prisma.invoice.create({
          data: {
            seriesId: num.seriesId,
            seriesPrefix: num.seriesPrefix,
            number: num.number,
            fullNumber: num.fullNumber,
            clientId: tpl.clientId,
            issueDate,
            dueDate: due,
            status: "PENDIENTE",
            paymentMethod: tpl.paymentMethod,
            notes: tpl.notes,
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            irpfRate: totals.irpfRate,
            irpfAmount: totals.irpfAmount,
            total: totals.total,
            vatOperationType: tpl.vatOperationType,
            cashAccounting: tpl.cashAccounting,
            operationKey: tpl.operationKey,
            operationKey347: tpl.operationKey347,
            recurringTemplateId: tpl.id,
            previousInvoiceId: lastInSeries?.id ?? null,
          },
        });

        for (const l of totals.lines) {
          await prisma.invoiceLine.create({
            data: {
              invoiceId: invoice.id,
              sortOrder: l.sortOrder,
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              vatRate: l.vatRate,
              discountPct: l.discountPct,
              lineSubtotal: l.lineSubtotal,
              lineVat: l.lineVat,
              lineTotal: l.lineTotal,
            },
          });
        }

        const nextRun = advanceDate(
          issueDate,
          tpl.frequency as Frequency,
          tpl.dayOfMonth,
          tpl.intervalCount
        );
        let status = tpl.status;
        if (tpl.endDate && dayKey(nextRun) > dayKey(tpl.endDate)) {
          status = "FINALIZADA";
        }

        await prisma.recurringInvoiceTemplate.update({
          where: { id: tpl.id },
          data: {
            lastRunAt: new Date(),
            nextRunDate: status === "FINALIZADA" ? null : nextRun,
            status,
          },
        });

        invoicesCreated++;
        details.push({
          templateId: tpl.id,
          name: tpl.name,
          invoiceId: invoice.id,
          fullNumber: invoice.fullNumber,
          subtotal: Number(invoice.subtotal),
          vatAmount: Number(invoice.vatAmount),
          total: Number(invoice.total),
        });
      } catch (err) {
        details.push({
          templateId: tpl.id,
          name: tpl.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await prisma.cronRunLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        success: true,
        templatesChecked: templates.length,
        invoicesCreated,
        details: JSON.stringify(details),
      },
    });

    return {
      ok: true,
      asOf: asOfKey,
      templatesChecked: templates.length,
      invoicesCreated,
      details,
      logId: log.id,
    };
  } catch (err) {
    await prisma.cronRunLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        details: JSON.stringify(details),
      },
    });
    throw err;
  }
}

function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function resolveAsOf(req: NextRequest): Date {
  const raw = req.nextUrl.searchParams.get("date");
  if (!raw) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      12,
      0,
      0,
      0
    );
  }
  const parsed = parseISO(raw);
  if (!isValid(parsed)) return new Date();
  return parsed;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runGeneration(resolveAsOf(req));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
