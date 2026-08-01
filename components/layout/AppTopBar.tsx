import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";

function quarterLabel(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `T${q} ${d.getFullYear()}`;
}

function todayLabel(d: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export async function AppTopBar({
  signOutSlot,
  userLabel,
}: {
  signOutSlot: ReactNode;
  userLabel?: string | null;
}) {
  const now = new Date();

  let pendingCount = 0;
  let overdueCount = 0;
  let pendingAmount = 0;

  try {
    const [pending, overdue, pendingInvoices] = await Promise.all([
      prisma.invoice.count({ where: { status: "PENDIENTE" } }),
      prisma.invoice.count({ where: { status: "VENCIDA" } }),
      prisma.invoice.findMany({
        where: { status: { in: ["PENDIENTE", "VENCIDA"] } },
        select: {
          total: true,
          payments: { select: { amount: true } },
        },
        take: 200,
      }),
    ]);
    pendingCount = pending;
    overdueCount = overdue;
    pendingAmount = pendingInvoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      return sum + Math.max(0, Number(inv.total) - paid);
    }, 0);
    pendingAmount = Math.round((pendingAmount + Number.EPSILON) * 100) / 100;
  } catch {
    /* layout no debe tumbar la app si falla la query */
  }

  const openCount = pendingCount + overdueCount;

  return (
    <header className="hidden border-b border-line/70 bg-transparent px-6 py-2.5 lg:block">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            {todayLabel(now)}
            <span className="mx-2 text-ink-muted/40">·</span>
            <span className="text-ink-muted">{quarterLabel(now)}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {openCount > 0 ? (
              <Link
                href="/invoices?status=PENDIENTE"
                className="text-ink-muted transition hover:text-accent"
              >
                {openCount} por cobrar
                {pendingAmount > 0 ? (
                  <span className="ml-1 font-mono text-ink">
                    {formatCurrency(pendingAmount)}
                  </span>
                ) : null}
              </Link>
            ) : (
              <span className="text-ink-muted">Sin cobros pendientes</span>
            )}
            {overdueCount > 0 ? (
              <Link
                href="/invoices?status=VENCIDA"
                className="font-medium text-danger transition hover:underline"
              >
                {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
              </Link>
            ) : null}
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Accesos rápidos">
          <Link href="/invoices/new" className="btn-primary px-3 py-1.5 text-xs">
            Nueva factura
          </Link>
          <Link
            href="/fiscal/expenses"
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Gastos
          </Link>
          <Link href="/quotes/new" className="btn-ghost px-3 py-1.5 text-xs">
            Presupuesto
          </Link>
          {userLabel ? (
            <span
              className="ml-1 hidden max-w-[10rem] truncate text-xs text-ink-muted xl:inline"
              title={userLabel}
            >
              {userLabel}
            </span>
          ) : null}
          <div className="ml-0.5 border-l border-line pl-1.5">{signOutSlot}</div>
        </nav>
      </div>
    </header>
  );
}
