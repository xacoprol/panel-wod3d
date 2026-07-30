import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fillEmailTemplate,
  isSmtpConfigured,
  sendMail,
} from "@/lib/mail";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { paymentTotals } from "@/lib/invoice-payments";
import { buildInvoicePdf } from "@/lib/pdf/build-document-pdf";
import { addDays, subDays } from "date-fns";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function runReminders(asOf: Date) {
  const settings = await prisma.companySettings.findFirst();
  if (!settings?.reminderEnabled) {
    return { skipped: true, reason: "Reminders disabled", sent: 0 };
  }
  if (!isSmtpConfigured()) {
    return { skipped: true, reason: "SMTP not configured", sent: 0 };
  }

  const company =
    settings.companyName?.trim() || settings.name?.trim() || "Empresa";
  const today = localNoon(asOf);
  const todayKey = dayKey(today);
  const beforeTarget = addDays(today, settings.reminderDaysBefore);
  const beforeKey = dayKey(beforeTarget);
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0,
    0
  );
  const overdueSince = subDays(dayStart, 7);

  // Mark overdue pending invoices.
  // Evitar updateMany: PrismaNeonHTTP lo envuelve en transacción y falla.
  await prisma.$executeRaw`
    UPDATE "Invoice"
    SET status = 'VENCIDA', "updatedAt" = NOW()
    WHERE status = 'PENDIENTE'
      AND "dueDate" IS NOT NULL
      AND "dueDate" < ${dayStart}
  `;

  const candidates = await prisma.invoice.findMany({
    where: {
      status: { in: ["PENDIENTE", "VENCIDA"] },
      dueDate: { not: null },
      client: { email: { not: null } },
    },
    include: {
      client: true,
      payments: true,
      reminders: {
        where: { sentAt: { gte: dayStart } },
        take: 1,
      },
    },
  });

  const details: {
    invoiceId: string;
    fullNumber: string;
    kind?: string;
    error?: string;
  }[] = [];
  let sent = 0;

  for (const inv of candidates) {
    if (inv.reminders.length > 0) continue; // already emailed today
    const email = inv.client.email?.trim();
    if (!email) continue;

    const totals = paymentTotals(inv.total, inv.payments);
    if (totals.remaining <= 0.001) continue;

    const dueKey = inv.dueDate ? dayKey(inv.dueDate) : null;
    if (!dueKey) continue;

    let kind: "BEFORE_DUE" | "OVERDUE" | null = null;

    if (dueKey === beforeKey && settings.reminderDaysBefore >= 0) {
      const alreadyBefore = await prisma.invoiceReminderLog.findFirst({
        where: { invoiceId: inv.id, kind: "BEFORE_DUE" },
      });
      if (!alreadyBefore) kind = "BEFORE_DUE";
    } else if (
      settings.reminderOnOverdue &&
      dueKey < todayKey
    ) {
      const recentOverdue = await prisma.invoiceReminderLog.findFirst({
        where: {
          invoiceId: inv.id,
          kind: "OVERDUE",
          sentAt: { gte: overdueSince },
        },
      });
      if (!recentOverdue) kind = "OVERDUE";
    }

    if (!kind) continue;

    const client = inv.client.name;
    const contact = inv.client.contactPerson?.trim() || client;
    const vars = {
      number: inv.fullNumber,
      company,
      client,
      contact,
      total: formatCurrency(totals.total),
      remaining: formatCurrency(totals.remaining),
      dueDate: inv.dueDate ? formatDate(inv.dueDate) : "—",
    };

    try {
      const pdf = await buildInvoicePdf(inv.id);
      await sendMail({
        to: email,
        subject: fillEmailTemplate(settings.reminderSubject, vars),
        text: fillEmailTemplate(settings.reminderBody, vars),
        attachments: [
          {
            filename: pdf.filename,
            content: pdf.buffer,
            contentType: "application/pdf",
          },
        ],
      });
      await prisma.invoiceReminderLog.create({
        data: { invoiceId: inv.id, kind },
      });
      sent += 1;
      details.push({
        invoiceId: inv.id,
        fullNumber: inv.fullNumber,
        kind,
      });
    } catch (err) {
      details.push({
        invoiceId: inv.id,
        fullNumber: inv.fullNumber,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { skipped: false, sent, details, asOf: todayKey };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReminders(new Date());
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
