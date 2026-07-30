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
import {
  buildInvoicePdf,
  buildQuotePdf,
} from "@/lib/pdf/build-document-pdf";

export type SendDocKind = "quote" | "invoice";

export type SendDocDraft = {
  configured: boolean;
  configHint: string;
  to: string;
  subject: string;
  body: string;
  docLabel: string;
  fullNumber: string;
  attachName: string;
};

export type SendDocResult = { ok: true } | { error: string };

export async function getSendDocumentDraft(
  kind: SendDocKind,
  id: string
): Promise<SendDocDraft | { error: string }> {
  await requireAuth();
  const settings = await prisma.companySettings.findFirst();
  const company =
    settings?.companyName?.trim() || settings?.name?.trim() || "Empresa";

  if (kind === "quote") {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { client: true },
    });
    if (!quote) return { error: "Presupuesto no encontrado" };
    const client = quote.client.name;
    const contact = quote.client.contactPerson?.trim() || client;
    return {
      configured: isSmtpConfigured(),
      configHint: smtpConfigHint(),
      to: quote.client.email?.trim() || "",
      subject: fillEmailTemplate(
        settings?.emailSubject ?? "Documento {{number}} de {{company}}",
        { number: quote.fullNumber, company, client, contact }
      ),
      body: fillEmailTemplate(
        settings?.emailBody ??
          "Hola {{contact}},\n\nAdjuntamos el documento {{number}}.\n\nUn saludo,\n{{company}}",
        { number: quote.fullNumber, company, client, contact }
      ),
      docLabel: "Presupuesto",
      fullNumber: quote.fullNumber,
      attachName: `Presupuesto_${quote.fullNumber}.pdf`,
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  const client = invoice.client.name;
  const contact = invoice.client.contactPerson?.trim() || client;
  return {
    configured: isSmtpConfigured(),
    configHint: smtpConfigHint(),
    to: invoice.client.email?.trim() || "",
    subject: fillEmailTemplate(
      settings?.emailSubject ?? "Documento {{number}} de {{company}}",
      { number: invoice.fullNumber, company, client, contact }
    ),
    body: fillEmailTemplate(
      settings?.emailBody ??
        "Hola {{contact}},\n\nAdjuntamos el documento {{number}}.\n\nUn saludo,\n{{company}}",
      { number: invoice.fullNumber, company, client, contact }
    ),
    docLabel: "Factura",
    fullNumber: invoice.fullNumber,
    attachName: `Factura_${invoice.fullNumber}.pdf`,
  };
}

export async function sendDocumentEmail(
  kind: SendDocKind,
  id: string,
  payload: { to: string; subject: string; body: string; attachPdf: boolean }
): Promise<SendDocResult> {
  await requireAuth();

  const to = payload.to.trim();
  if (!to) return { error: "Indica el email del destinatario" };
  if (!payload.subject.trim()) return { error: "El asunto es obligatorio" };
  if (!isSmtpConfigured()) return { error: smtpConfigHint() };

  try {
    const pdf =
      kind === "quote" ? await buildQuotePdf(id) : await buildInvoicePdf(id);

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

    if (kind === "quote") {
      await prisma.quote.update({
        where: { id },
        data: { status: "ENVIADO" },
      });
      revalidatePath("/quotes");
      revalidatePath(`/quotes/${id}`);
    } else {
      revalidatePath("/invoices");
      revalidatePath(`/invoices/${id}`);
    }

    return { ok: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo enviar el correo",
    };
  }
}
