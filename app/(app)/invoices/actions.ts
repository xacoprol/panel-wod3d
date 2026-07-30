"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { calculateDocument, type LineInput } from "@/lib/calculations";
import { allocateInvoiceNumber, syncInvoiceSeriesNextNumber } from "@/lib/numbering";

export type DocFormState = { error?: string };

function parseLines(formData: FormData): LineInput[] {
  const raw = String(formData.get("linesJson") ?? "[]");
  return (JSON.parse(raw) as LineInput[]).filter((l) => l.description?.trim());
}

async function createInvoiceLines(
  invoiceId: string,
  lines: ReturnType<typeof calculateDocument>["lines"]
) {
  for (const l of lines) {
    await prisma.invoiceLine.create({
      data: {
        invoiceId,
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
}

export async function createInvoice(
  _prev: DocFormState,
  formData: FormData
): Promise<DocFormState> {
  await requireAuth();
  try {
    const clientId = String(formData.get("clientId") ?? "");
    const seriesId = String(formData.get("seriesId") ?? "") || undefined;
    const lines = parseLines(formData);
    const irpfRate = parseFloat(String(formData.get("irpfRate") ?? "0")) || 0;

    if (!clientId) return { error: "Selecciona un cliente" };
    if (!lines.length) return { error: "Añade al menos una línea" };

    const totals = calculateDocument(lines, irpfRate);
    const issueDate = new Date(String(formData.get("issueDate")));
    const dueRaw = String(formData.get("dueDate") ?? "");

    const num = await allocateInvoiceNumber(prisma, seriesId);
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
        clientId,
        issueDate,
        dueDate: dueRaw ? new Date(dueRaw) : null,
        status: "PENDIENTE",
        paymentMethod:
          String(formData.get("paymentMethod") ?? "").trim() || "Transferencia",
        notes: String(formData.get("notes") ?? "").trim() || null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        irpfRate: totals.irpfRate,
        irpfAmount: totals.irpfAmount,
        total: totals.total,
        previousInvoiceId: lastInSeries?.id ?? null,
      },
    });
    await createInvoiceLines(invoice.id, totals.lines);

    revalidatePath("/invoices");
    redirect(`/invoices/${invoice.id}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return {
      error: err instanceof Error ? err.message : "No se pudo crear la factura",
    };
  }
}

export async function updateInvoice(
  id: string,
  _prev: DocFormState,
  formData: FormData
): Promise<DocFormState> {
  await requireAuth();
  try {
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) return { error: "Factura no encontrada" };
    if (existing.status === "ANULADA") {
      return { error: "No se puede editar una factura anulada" };
    }

    const clientId = String(formData.get("clientId") ?? "");
    const lines = parseLines(formData);
    const irpfRate = parseFloat(String(formData.get("irpfRate") ?? "0")) || 0;
    if (!clientId) return { error: "Selecciona un cliente" };
    if (!lines.length) return { error: "Añade al menos una línea" };

    const totals = calculateDocument(lines, irpfRate);
    const issueDate = new Date(String(formData.get("issueDate")));
    const dueRaw = String(formData.get("dueDate") ?? "");
    const status = String(formData.get("status") ?? existing.status);

    await prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await prisma.invoice.update({
      where: { id },
      data: {
        clientId,
        issueDate,
        dueDate: dueRaw ? new Date(dueRaw) : null,
        status,
        paymentMethod:
          String(formData.get("paymentMethod") ?? "").trim() || "Transferencia",
        notes: String(formData.get("notes") ?? "").trim() || null,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        irpfRate: totals.irpfRate,
        irpfAmount: totals.irpfAmount,
        total: totals.total,
      },
    });
    await createInvoiceLines(id, totals.lines);

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    redirect(`/invoices/${id}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return {
      error: err instanceof Error ? err.message : "No se pudo guardar la factura",
    };
  }
}

export async function setInvoiceStatus(id: string, status: string) {
  await requireAuth();
  const allowed = ["PENDIENTE", "PAGADA", "VENCIDA", "ANULADA"];
  if (!allowed.includes(status)) throw new Error("Estado no válido");

  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) throw new Error("Factura no encontrada");
  // Anulada is terminal for numbering purposes — number stays reserved
  await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

/** Anular mantiene el número reservado */
export async function annulInvoice(id: string) {
  await setInvoiceStatus(id, "ANULADA");
}

/**
 * Elimina la factura y recalcula el correlativo de la serie
 * (si era la última, el próximo número vuelve a ser el suyo).
 */
export async function deleteInvoice(id: string) {
  await requireAuth();
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Factura no encontrada");

  await prisma.invoice.updateMany({
    where: { previousInvoiceId: id },
    data: { previousInvoiceId: null },
  });

  await prisma.invoice.delete({ where: { id } });
  await syncInvoiceSeriesNextNumber(prisma, invoice.seriesId, invoice.number);

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect("/invoices");
}
