"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { calculateDocument, type LineInput } from "@/lib/calculations";
import { allocateQuoteNumber, allocateInvoiceNumber } from "@/lib/numbering";

export type DocFormState = { error?: string };

function parseLines(formData: FormData): LineInput[] {
  const raw = String(formData.get("linesJson") ?? "[]");
  const lines = JSON.parse(raw) as LineInput[];
  return lines.filter((l) => l.description?.trim());
}

function toDate(value: FormDataEntryValue | null): Date {
  return new Date(String(value));
}

export async function createQuote(
  _prev: DocFormState,
  formData: FormData
): Promise<DocFormState> {
  await requireAuth();
  const clientId = String(formData.get("clientId") ?? "");
  const lines = parseLines(formData);
  if (!clientId) return { error: "Selecciona un cliente" };
  if (!lines.length) return { error: "Añade al menos una línea" };

  const totals = calculateDocument(lines);
  const issueDate = toDate(formData.get("issueDate"));
  const validUntilRaw = String(formData.get("validUntil") ?? "");
  const status = String(formData.get("status") ?? "BORRADOR");

  const quote = await prisma.$transaction(async (tx) => {
    const num = await allocateQuoteNumber(tx);
    return tx.quote.create({
      data: {
        seriesId: num.seriesId,
        seriesPrefix: num.seriesPrefix,
        number: num.number,
        fullNumber: num.fullNumber,
        clientId,
        issueDate,
        validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
        status,
        notes: String(formData.get("notes") ?? "").trim() || null,
        conditions: String(formData.get("conditions") ?? "").trim() || null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
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
  });

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

export async function updateQuote(
  id: string,
  _prev: DocFormState,
  formData: FormData
): Promise<DocFormState> {
  await requireAuth();
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) return { error: "Presupuesto no encontrado" };
  if (existing.status === "ACEPTADO" && existing) {
    // still allow edits unless converted — check invoice
    const inv = await prisma.invoice.findUnique({ where: { quoteId: id } });
    if (inv) return { error: "Ya convertido en factura; no se puede editar" };
  }

  const clientId = String(formData.get("clientId") ?? "");
  const lines = parseLines(formData);
  if (!clientId) return { error: "Selecciona un cliente" };
  if (!lines.length) return { error: "Añade al menos una línea" };

  const totals = calculateDocument(lines);
  const issueDate = toDate(formData.get("issueDate"));
  const validUntilRaw = String(formData.get("validUntil") ?? "");
  const status = String(formData.get("status") ?? existing.status);

  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: id } });
    await tx.quote.update({
      where: { id },
      data: {
        clientId,
        issueDate,
        validUntil: validUntilRaw ? new Date(validUntilRaw) : null,
        status,
        notes: String(formData.get("notes") ?? "").trim() || null,
        conditions: String(formData.get("conditions") ?? "").trim() || null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        total: totals.total,
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
  });

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function convertQuoteToInvoice(quoteId: string) {
  await requireAuth();
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) throw new Error("Presupuesto no encontrado");

  const existing = await prisma.invoice.findUnique({
    where: { quoteId },
  });
  if (existing) redirect(`/invoices/${existing.id}`);

  const settings = await prisma.companySettings.findFirst();
  const irpfRate = settings?.defaultIrpfRate ?? 0;
  const lineInputs = quote.lines.map((l) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unitPrice),
    vatRate: l.vatRate,
    discountPct: l.discountPct,
  }));
  const totals = calculateDocument(lineInputs, irpfRate);

  const due = new Date(quote.issueDate);
  due.setDate(due.getDate() + 30);

  const invoice = await prisma.$transaction(async (tx) => {
    const num = await allocateInvoiceNumber(tx);
    const lastInSeries = await tx.invoice.findFirst({
      where: { seriesId: num.seriesId, status: { not: "ANULADA" } },
      orderBy: { number: "desc" },
    });

    const inv = await tx.invoice.create({
      data: {
        seriesId: num.seriesId,
        seriesPrefix: num.seriesPrefix,
        number: num.number,
        fullNumber: num.fullNumber,
        clientId: quote.clientId,
        issueDate: new Date(),
        dueDate: due,
        status: "PENDIENTE",
        notes: quote.notes,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        irpfRate: totals.irpfRate,
        irpfAmount: totals.irpfAmount,
        total: totals.total,
        quoteId: quote.id,
        previousInvoiceId: lastInSeries?.id ?? null,
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

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "ACEPTADO" },
    });

    return inv;
  });

  revalidatePath("/quotes");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function deleteQuote(id: string) {
  await requireAuth();
  const inv = await prisma.invoice.findUnique({ where: { quoteId: id } });
  if (inv) {
    throw new Error("No se puede eliminar: ya convertido en factura");
  }
  await prisma.quote.delete({ where: { id } });
  revalidatePath("/quotes");
  redirect("/quotes");
}
