"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import {
  fillEmailTemplate,
  isSmtpConfigured,
  sendMail,
  smtpConfigHint,
} from "@/lib/mail";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { paymentTotals } from "@/lib/invoice-payments";
import { buildInvoicePdf } from "@/lib/pdf/build-document-pdf";
import type { SendDocDraft, SendDocResult } from "./send-actions";

export async function getReminderDraft(
  invoiceId: string
): Promise<SendDocDraft | { error: string }> {
  await requireAuth();
  const settings = await prisma.companySettings.findFirst();
  const company =
    settings?.companyName?.trim() || settings?.name?.trim() || "Empresa";

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, payments: true },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  if (invoice.status === "ANULADA" || invoice.status === "PAGADA") {
    return { error: "Esta factura no necesita recordatorio" };
  }

  const totals = paymentTotals(invoice.total, invoice.payments);
  const client = invoice.client.name;
  const contact = invoice.client.contactPerson?.trim() || client;
  const vars = {
    number: invoice.fullNumber,
    company,
    client,
    contact,
    total: formatCurrency(totals.total),
    remaining: formatCurrency(totals.remaining),
    dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : "—",
  };

  return {
    configured: isSmtpConfigured(),
    configHint: smtpConfigHint(),
    to: invoice.client.email?.trim() || "",
    subject: fillEmailTemplate(
      settings?.reminderSubject ??
        "Recordatorio: factura {{number}} pendiente",
      vars
    ),
    body: fillEmailTemplate(
      settings?.reminderBody ??
        "Hola {{contact}},\n\nLe recordamos que la factura {{number}} por {{remaining}} vence el {{dueDate}}.\n\nUn saludo,\n{{company}}",
      vars
    ),
    docLabel: "Recordatorio",
    fullNumber: invoice.fullNumber,
    attachName: `Factura_${invoice.fullNumber}.pdf`,
  };
}

export async function sendPaymentReminder(
  invoiceId: string,
  payload: { to: string; subject: string; body: string; attachPdf: boolean }
): Promise<SendDocResult> {
  await requireAuth();

  const to = payload.to.trim();
  if (!to) return { error: "Indica el email del destinatario" };
  if (!payload.subject.trim()) return { error: "El asunto es obligatorio" };
  if (!isSmtpConfigured()) return { error: smtpConfigHint() };

  try {
    const pdf = await buildInvoicePdf(invoiceId);
    await sendMail({
      to,
      subject: payload.subject.trim(),
      text: payload.body,
      attachments: payload.attachPdf
        ? [
            {
              filename: pdf.filename,
              content: pdf.buffer,
              contentType: "application/pdf",
            },
          ]
        : undefined,
    });

    await prisma.invoiceReminderLog.create({
      data: { invoiceId, kind: "MANUAL" },
    });

    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo enviar el recordatorio",
    };
  }
}
