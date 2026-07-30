import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  subMonths,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RevenueChart } from "@/components/dashboard/RevenueChart";

async function sumInvoices(from: Date, to: Date) {
  const rows = await prisma.invoice.findMany({
    where: {
      status: { not: "ANULADA" },
      issueDate: { gte: from, lte: to },
    },
    select: { total: true },
  });
  return rows.reduce((s, r) => s + Number(r.total), 0);
}

export default async function DashboardPage() {
  const now = new Date();
  const [
    monthTotal,
    quarterTotal,
    yearTotal,
    upcoming,
    recentPending,
  ] = await Promise.all([
    sumInvoices(startOfMonth(now), endOfMonth(now)),
    sumInvoices(startOfQuarter(now), endOfQuarter(now)),
    sumInvoices(startOfYear(now), endOfYear(now)),
    prisma.recurringInvoiceTemplate.findMany({
      where: { status: "ACTIVA", nextRunDate: { not: null } },
      include: { client: true },
      orderBy: { nextRunDate: "asc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["PENDIENTE", "VENCIDA"] } },
      include: { client: true, payments: { select: { amount: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  const pendingList = await prisma.invoice.findMany({
    where: { status: { in: ["PENDIENTE", "VENCIDA"] } },
    include: { payments: { select: { amount: true } } },
  });
  const pendingAmount = pendingList.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    return sum + Math.max(0, Number(inv.total) - paid);
  }, 0);
  const pendingCount = pendingList.length;

  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(now, i);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    const total = await sumInvoices(from, to);
    chartData.push({
      label: format(d, "MMM yy", { locale: es }),
      total,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Resumen de facturación y cobros pendientes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Mes actual", value: monthTotal },
          { label: "Trimestre", value: quarterTotal },
          { label: "Año", value: yearTotal },
          {
            label: "Pendiente de cobro",
            value: pendingAmount,
            hint: `${pendingCount} facturas`,
          },
        ].map((card) => (
          <div key={card.label} className="card-panel p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {card.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">
              {formatCurrency(card.value)}
            </p>
            {"hint" in card && card.hint && (
              <p className="mt-1 text-xs text-ink-muted">{card.hint}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card-panel p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold">Ingresos (6 meses)</h2>
          <RevenueChart data={chartData} />
        </section>

        <section className="card-panel p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Próximas periódicas</h2>
            <Link href="/recurring" className="text-xs text-accent hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="space-y-3 text-sm">
            {upcoming.length === 0 ? (
              <li className="text-ink-muted">No hay periódicas activas</li>
            ) : (
              upcoming.map((t) => (
                <li key={t.id} className="flex justify-between gap-2 border-b border-line/50 pb-2">
                  <div>
                    <Link
                      href={`/recurring/${t.id}`}
                      className="font-medium hover:text-accent"
                    >
                      {t.name}
                    </Link>
                    <p className="text-xs text-ink-muted">{t.client.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatDate(t.nextRunDate)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="card-panel overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Facturas pendientes / vencidas</h2>
          <Link href="/invoices?status=PENDIENTE" className="text-xs text-accent hover:underline">
            Ver facturas
          </Link>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {recentPending.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-ink-muted">
                  Todo al día
                </td>
              </tr>
            ) : (
              recentPending.map((inv) => (
                <tr
                  key={inv.id}
                  className="relative cursor-pointer border-b border-line/50 transition hover:bg-accent-soft/40"
                >
                  <td className="px-4 py-2 font-mono">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="after:absolute after:inset-0 hover:text-accent"
                    >
                      {inv.fullNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{inv.client.name}</td>
                  <td className="px-4 py-2 text-ink-muted">
                    Vence {formatDate(inv.dueDate)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(inv.total) -
                          inv.payments.reduce((s, p) => s + Number(p.amount), 0)
                      )
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
