import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { DateInput } from "@/components/ui/DateInput";
import {
  InvoicesTable,
  type InvoiceListRow,
} from "@/components/invoices/InvoicesTable";

function primaryVatRate(rates: number[]): number | null {
  if (!rates.length) return null;
  const counts = new Map<number, number>();
  for (const r of rates) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best = rates[0];
  let bestCount = 0;
  for (const [rate, count] of counts) {
    if (count > bestCount) {
      best = rate;
      bestCount = count;
    }
  }
  return best;
}

const LEGAL_LABELS: Record<string, string> = {
  SUJETA: "Sujeta a IVA",
  EXENTA: "Exenta",
  INTRACOMUNITARIA: "Intracomunitaria",
  EXPORTACION: "Exportación",
};

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
    include: {
      client: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        select: { vatRate: true, description: true },
      },
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    skip: meta.skip,
    take: meta.take,
  });

  const rows: InvoiceListRow[] = invoices.map((inv) => {
    const totalAmt = Number(inv.total);
    const pending =
      inv.status === "PAGADA" || inv.status === "ANULADA" ? 0 : totalAmt;
    return {
      id: inv.id,
      fullNumber: inv.fullNumber,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate?.toISOString() ?? null,
      status: inv.status,
      paymentMethod: inv.paymentMethod,
      notes: inv.notes,
      subtotal: Number(inv.subtotal),
      vatAmount: Number(inv.vatAmount),
      irpfRate: inv.irpfRate,
      irpfAmount: Number(inv.irpfAmount),
      total: totalAmt,
      pendingAmount: pending,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      primaryVatRate: primaryVatRate(inv.lines.map((l) => l.vatRate)),
      description: inv.lines[0]?.description ?? null,
      legal: LEGAL_LABELS[inv.vatOperationType] ?? inv.vatOperationType,
      clientName: inv.client.name,
      clientNif: inv.client.nif,
    };
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

      <InvoicesTable invoices={rows} />

      <Pagination
        basePath="/invoices"
        params={params}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.pageSize}
      />
    </div>
  );
}
