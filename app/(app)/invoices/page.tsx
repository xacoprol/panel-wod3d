import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { DateInput } from "@/components/ui/DateInput";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.from || sp.to
      ? {
          issueDate: {
            ...(sp.from ? { gte: new Date(sp.from) } : {}),
            ...(sp.to ? { lte: new Date(sp.to) } : {}),
          },
        }
      : {}),
  };

  const total = await prisma.invoice.count({ where });
  const meta = paginationMeta(total, page);

  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    skip: meta.skip,
    take: meta.take,
  });

  const params = { status: sp.status, from: sp.from, to: sp.to };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Numeración correlativa · al borrar la última se reutiliza el número
          </p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          Nueva factura
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Estado</label>
          <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
            <option value="">Todos</option>
            {["PENDIENTE", "PAGADA", "VENCIDA", "ANULADA"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Desde</label>
          <DateInput name="from" defaultValue={sp.from ?? ""} className="input w-auto" />
        </div>
        <div>
          <label className="label">Hasta</label>
          <DateInput name="to" defaultValue={sp.to ?? ""} className="input w-auto" />
        </div>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Emisión</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No hay facturas.{" "}
                  <Link href="/invoices/new" className="text-accent underline">
                    Emitir una
                  </Link>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="relative border-b border-line/60 hover:bg-accent-soft/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-mono after:absolute after:inset-0 hover:text-accent"
                    >
                      {inv.fullNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.client.name}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(inv.issueDate)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(inv.dueDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(inv.total))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          basePath="/invoices"
          params={params}
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={meta.pageSize}
        />
      </div>
    </div>
  );
}
