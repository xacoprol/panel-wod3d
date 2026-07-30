import { prisma } from "@/lib/prisma";

export type PaymentTotals = {
  total: number;
  paid: number;
  remaining: number;
};

export function sumPayments(
  payments: { amount: { toString(): string } | number }[]
): number {
  return payments.reduce((s, p) => s + Number(p.amount), 0);
}

export function paymentTotals(
  invoiceTotal: { toString(): string } | number,
  payments: { amount: { toString(): string } | number }[]
): PaymentTotals {
  const total = Number(invoiceTotal);
  const paid = Math.min(sumPayments(payments), total);
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  return { total, paid: Math.round(paid * 100) / 100, remaining };
}

/** Status derived from payments + due date (never overrides ANULADA). */
export function statusFromPayments(opts: {
  currentStatus: string;
  total: number;
  paid: number;
  dueDate: Date | null;
  asOf?: Date;
}): string {
  if (opts.currentStatus === "ANULADA") return "ANULADA";
  const asOf = opts.asOf ?? new Date();
  const fullyPaid = opts.paid + 0.001 >= opts.total && opts.total > 0
    ? true
    : opts.paid >= opts.total;
  if (fullyPaid && opts.total > 0) return "PAGADA";
  if (opts.paid >= opts.total && opts.total === 0) return "PAGADA";

  const overdue =
    opts.dueDate != null &&
    dayKey(opts.dueDate) < dayKey(asOf);

  return overdue ? "VENCIDA" : "PENDIENTE";
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Recalculate and persist invoice status from its payments. */
export async function syncInvoicePaymentStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return null;

  const { total, paid } = paymentTotals(invoice.total, invoice.payments);
  const status = statusFromPayments({
    currentStatus: invoice.status,
    total,
    paid,
    dueDate: invoice.dueDate,
  });

  if (status !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }

  return { total, paid, remaining: Math.max(0, total - paid), status };
}
