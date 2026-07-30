"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { calculateDocument, type LineInput } from "@/lib/calculations";
import { allocateInvoiceNumber, syncInvoiceSeriesNextNumber } from "@/lib/numbering";
import {
  paymentTotals,
  syncInvoicePaymentStatus,
} from "@/lib/invoice-payments";

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
    await syncInvoicePaymentStatus(id);

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

  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!inv) throw new Error("Factura no encontrada");

  if (status === "ANULADA") {
    await prisma.invoice.update({ where: { id }, data: { status: "ANULADA" } });
  } else if (status === "PAGADA") {
    const { remaining } = paymentTotals(inv.total, inv.payments);
    if (remaining > 0.001) {
      await prisma.invoicePayment.create({
        data: {
          invoiceId: id,
          amount: remaining,
          paidAt: new Date(),
          method: inv.paymentMethod || "Transferencia",
          notes: "Marcada como pagada",
        },
      });
    }
    await prisma.invoice.update({ where: { id }, data: { status: "PAGADA" } });
  } else if (status === "PENDIENTE") {
    // Clear payments so status stays consistent with paid amount
    await prisma.invoicePayment.deleteMany({ where: { invoiceId: id } });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const overdue = inv.dueDate != null && inv.dueDate < startOfToday;
    await prisma.invoice.update({
      where: { id },
      data: { status: overdue ? "VENCIDA" : "PENDIENTE" },
    });
  } else {
    await prisma.invoice.update({ where: { id }, data: { status } });
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
}

export async function addInvoicePayment(invoiceId: string, formData: FormData) {
  await requireAuth();
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!inv) throw new Error("Factura no encontrada");
  if (inv.status === "ANULADA") throw new Error("Factura anulada");

  const amount = parseFloat(String(formData.get("amount") ?? ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Importe no válido");
  }

  const { remaining } = paymentTotals(inv.total, inv.payments);
  if (amount > remaining + 0.01) {
    throw new Error(`El cobro supera lo pendiente (${remaining.toFixed(2)} €)`);
  }

  const paidAtRaw = String(formData.get("paidAt") ?? "").trim();
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();

  await prisma.invoicePayment.create({
    data: {
      invoiceId,
      amount,
      paidAt,
      method: String(formData.get("method") ?? "").trim() || inv.paymentMethod || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  await syncInvoicePaymentStatus(invoiceId);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
}

export async function deleteInvoicePayment(paymentId: string) {
  await requireAuth();
  const payment = await prisma.invoicePayment.findUnique({
    where: { id: paymentId },
  });
  if (!payment) throw new Error("Cobro no encontrado");

  await prisma.invoicePayment.delete({ where: { id: paymentId } });
  await syncInvoicePaymentStatus(payment.invoiceId);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${payment.invoiceId}`);
  revalidatePath("/dashboard");
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
