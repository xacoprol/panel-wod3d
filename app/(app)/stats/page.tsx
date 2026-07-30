import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { buildYearStats } from "@/lib/stats";
import { buildFiscalYearSummary } from "@/lib/fiscal";
import {
  CashflowChart,
  IncomeMixChart,
} from "@/components/stats/StatsCharts";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const nowY = new Date().getFullYear();
  const yearRaw = parseInt(sp.year ?? "", 10);
  const year =
    Number.isFinite(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : nowY;

  const [stats, fiscal, invBounds, mktBounds] = await Promise.all([
    buildYearStats(year),
    buildFiscalYearSummary(year),
    prisma.invoice.aggregate({
      _min: { issueDate: true },
      _max: { issueDate: true },
    }),
    prisma.marketplaceIncome.aggregate({
      _min: { issueDate: true },
      _max: { issueDate: true },
    }),
  ]);

  const yearsFromDates = [
    invBounds._min.issueDate?.getFullYear(),
    invBounds._max.issueDate?.getFullYear(),
    mktBounds._min.issueDate?.getFullYear(),
    mktBounds._max.issueDate?.getFullYear(),
  ].filter((y): y is number => typeof y === "number");
  const minY = yearsFromDates.length ? Math.min(...yearsFromDates) : nowY;
  const maxY = Math.max(...yearsFromDates, nowY);
  const years: number[] = [];
  for (let y = maxY; y >= Math.min(minY, nowY - 2); y--) years.push(y);

  const mixData = stats.months.map((m) => ({
    label: m.label,
    invoicesBase: m.invoicesBase,
    amazonBase: m.amazonBase,
    shopifyBase: m.shopifyBase,
  }));

  const cashData = stats.months.map((m) => ({
    label: m.label,
    invoicesTotal: m.invoicesTotal,
    collected: m.collected,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estadísticas
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Ingresos reales: bases W3D + Amazon/Shopify, cobros y gastos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <Link
              key={y}
              href={`/stats?year=${y}`}
              className={
                y === year
                  ? "btn-primary px-3 py-1.5 text-sm"
                  : "btn-ghost px-3 py-1.5 text-sm"
              }
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      <p className="rounded-lg border border-line bg-accent-soft/40 px-4 py-3 text-sm text-ink-muted">
        <strong className="font-medium text-ink">Ingresos</strong> = base
        imponible de facturas W3D + marketplace.{" "}
        <strong className="font-medium text-ink">Cobrado</strong> = pagos
        registrados en facturas (caja). Amazon/Shopify se cuentan por fecha del
        informe importado.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: "Ingresos (base)",
            value: stats.incomeBase,
            hint: "W3D + marketplaces",
          },
          {
            label: "Facturado W3D",
            value: stats.invoicesTotal,
            hint: `Base ${formatCurrency(stats.invoicesBase)}`,
          },
          {
            label: "Cobrado",
            value: stats.collected,
            hint: "Pagos del año",
          },
          {
            label: "Pendiente cobro",
            value: stats.pendingCollect,
            hint: `${stats.pendingCount} facturas`,
          },
          {
            label: "Gastos (base)",
            value: stats.expensesBase,
            hint: "Deducibles",
          },
          {
            label: "Margen neto",
            value: stats.netBase,
            hint: "Ingresos − gastos",
          },
        ].map((card) => (
          <div key={card.label} className="card-panel p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {card.label}
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tracking-tight">
              {formatCurrency(card.value)}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="card-panel p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Fiscal del año</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Estimaciones 303 / 130 (suma de trimestres)
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/fiscal/annual?year=${year}`}
              className="text-xs text-accent hover:underline"
            >
              Ver resumen anual
            </Link>
            <Link
              href={`/fiscal/390?year=${year}`}
              className="text-xs text-accent hover:underline"
            >
              Modelo 390
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "IVA neto (303)",
              value: fiscal.ivaNetYear,
              hint:
                fiscal.ivaNetYear >= 0
                  ? "A ingresar (suma T)"
                  : "A compensar (suma T)",
              href: `/fiscal/303?year=${year}`,
            },
            {
              label: "IRPF fraccionado (130)",
              value: fiscal.irpfPaymentsYear,
              hint: "Suma pagos T",
              href: `/fiscal/130?year=${year}`,
            },
            {
              label: "Retenciones IRPF",
              value: fiscal.issued.irpfWithheld,
              hint: "Facturas emitidas",
            },
            {
              label: "IVA soportado",
              value: fiscal.expenses.vatDeductible,
              hint: "Gastos deducibles",
              href: "/fiscal/expenses",
            },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-line/60 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {card.label}
              </p>
              <p className="mt-1.5 font-mono text-lg font-semibold tracking-tight">
                {"href" in card && card.href ? (
                  <Link href={card.href} className="hover:text-accent">
                    {formatCurrency(card.value)}
                  </Link>
                ) : (
                  formatCurrency(card.value)
                )}
              </p>
              <p className="mt-1 text-xs text-ink-muted">{card.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-panel p-4">
          <p className="text-xs text-ink-muted">Amazon (base)</p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {formatCurrency(stats.amazonBase)}
          </p>
        </div>
        <div className="card-panel p-4">
          <p className="text-xs text-ink-muted">Shopify (base)</p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {formatCurrency(stats.shopifyBase)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-panel p-5">
          <h2 className="mb-1 text-sm font-semibold">
            Ingresos por canal ({year})
          </h2>
          <p className="mb-4 text-xs text-ink-muted">
            Bases imponibles apiladas por mes
          </p>
          <IncomeMixChart data={mixData} />
        </section>
        <section className="card-panel p-5">
          <h2 className="mb-1 text-sm font-semibold">
            Facturado vs cobrado W3D ({year})
          </h2>
          <p className="mb-4 text-xs text-ink-muted">
            Emitido por fecha de factura · cobrado por fecha de pago
          </p>
          <CashflowChart data={cashData} />
        </section>
      </div>

      <section className="card-panel overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Top clientes (facturado W3D)</h2>
        </div>
        {stats.topClients.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Sin facturas en {year}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Cliente</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.topClients.map((c) => (
                <tr key={c.clientId} className="border-b border-line/50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/clients/${c.clientId}`}
                      className="hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(c.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
