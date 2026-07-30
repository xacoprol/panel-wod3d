import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { EXPENSE_CATEGORIES } from "@/lib/fiscal";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { LiveSearch } from "@/components/ui/LiveSearch";
import { ExpenseDropZone } from "@/components/fiscal/ExpenseDropZone";
import { deleteExpense } from "./actions";

const categoryLabel = (id: string) =>
  EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export default async function ExpensesPage({
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
          { supplierName: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { supplierNif: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const total = await prisma.expense.count({ where });
  const meta = paginationMeta(total, page);
  const expenses = await prisma.expense.findMany({
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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gastos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Facturas recibidas para IVA soportado y modelo 130
          </p>
        </div>
        <Link href="/fiscal/expenses/new" className="btn-ghost text-sm">
          Alta manual
        </Link>
      </div>

      <ExpenseDropZone />

      <Suspense fallback={<div className="input max-w-md animate-pulse" />}>
        <LiveSearch placeholder="Buscar proveedor, NIF o concepto…" />
      </Suspense>

      <div className="card-panel overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Categoría
              </th>
              <th className="px-4 py-3 font-medium text-right">Base</th>
              <th className="px-4 py-3 font-medium text-right">IVA</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="sticky right-0 z-10 bg-line/20 px-2 py-3 text-right font-medium sm:static sm:bg-transparent sm:px-4">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  No hay gastos{query ? " con ese criterio" : ""}.{" "}
                  <Link
                    href="/fiscal/expenses/new"
                    className="text-accent underline"
                  >
                    Registrar el primero
                  </Link>
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="group border-b border-line/50">
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(e.issueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{e.supplierName}</span>
                    {e.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                        {e.description}
                      </p>
                    ) : null}
                    {!e.deductible ? (
                      <span className="badge mt-1 bg-line text-ink-muted">
                        No deducible
                      </span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">
                    {categoryLabel(e.category)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(e.subtotal))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(e.vatAmount))}
                    <span className="ml-1 text-xs text-ink-muted">
                      ({e.vatRate}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(e.total))}
                  </td>
                  <td className="sticky right-0 z-10 bg-bg-elevated px-2 py-3 group-hover:bg-accent-soft/20 sm:static sm:bg-transparent sm:px-4">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                      <Link
                        href={`/fiscal/expenses/${e.id}/edit`}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        Editar
                      </Link>
                      <form action={deleteExpense.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="btn-ghost px-2 py-1 text-xs text-danger"
                        >
                          Borrar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/fiscal/expenses"
        params={{ q: query }}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.pageSize}
      />
    </div>
  );
}
