import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { MarketplaceIncomeDropZone } from "@/components/fiscal/MarketplaceIncomeDropZone";
import { deleteMarketplaceIncome } from "./actions";

const VAT_LABEL: Record<string, string> = {
  TAXABLE: "Con IVA",
  EXEMPT: "Sin IVA",
  MARKETPLACE_COLLECTED: "OSS marketplace",
};

const CHANNEL_LABEL: Record<string, string> = {
  AMAZON: "Amazon",
  SHOPIFY: "Shopify",
};

export default async function MarketplaceIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim();
  const page = parsePage(sp.page);

  const where = query
    ? {
        OR: [
          { externalRef: { contains: query, mode: "insensitive" as const } },
          { orderId: { contains: query, mode: "insensitive" as const } },
          { sku: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { channel: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const total = await prisma.marketplaceIncome.count({ where });
  const meta = paginationMeta(total, page);
  const rows = await prisma.marketplaceIncome.findMany({
    where,
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    skip: meta.skip,
    take: meta.take,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/fiscal" className="text-sm text-ink-muted hover:text-accent">
            ← Fiscal
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Ingresos marketplace
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Amazon (VAT Tax Report) y Shopify (ventas por país) · no usan la
            serie W3D
          </p>
        </div>
      </div>

      <MarketplaceIncomeDropZone />

      <Suspense fallback={<div className="input max-w-md animate-pulse" />}>
        <LiveSearch placeholder="Buscar factura Amazon, pedido, SKU…" />
      </Suspense>

      <div className="card-panel overflow-x-auto">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Ref.</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                IVA
              </th>
              <th className="px-4 py-3 text-right font-medium">Base</th>
              <th className="px-4 py-3 text-right font-medium">Cuota</th>
              <th className="sticky right-0 z-10 bg-line/20 px-2 py-3 text-right font-medium sm:static sm:bg-transparent sm:px-4">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  No hay ingresos importados
                  {query ? " con ese criterio" : ""}. Sube el CSV de Amazon
                  arriba.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="group border-b border-line/50">
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(r.issueDate)}
                  </td>
                  <td className="px-4 py-3">
                    {CHANNEL_LABEL[r.channel] ?? r.channel}
                    <p className="text-xs text-ink-muted">
                      {r.transactionType}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">
                      {r.externalRef ?? "—"}
                    </span>
                    {r.sku ? (
                      <p className="text-xs text-ink-muted">{r.sku}</p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">
                    {VAT_LABEL[r.vatStatus] ?? r.vatStatus}
                    {r.vatStatus === "TAXABLE" ? ` ${r.vatRate}%` : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(r.subtotal))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(r.vatAmount))}
                  </td>
                  <td className="sticky right-0 z-10 bg-bg-elevated px-2 py-3 group-hover:bg-accent-soft/20 sm:static sm:bg-transparent sm:px-4">
                    <form action={deleteMarketplaceIncome.bind(null, r.id)}>
                      <button
                        type="submit"
                        className="btn-ghost px-2 py-1 text-xs text-danger"
                      >
                        Borrar
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/fiscal/income"
        params={{ q: query }}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.pageSize}
      />
    </div>
  );
}
