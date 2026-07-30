import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { QuotesTable, type QuoteListRow } from "@/components/quotes/QuotesTable";

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

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; clientId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const where = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.clientId ? { clientId: sp.clientId } : {}),
  };

  const total = await prisma.quote.count({ where });
  const meta = paginationMeta(total, page);

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      client: true,
      invoice: { select: { id: true } },
      lines: { select: { vatRate: true } },
    },
    orderBy: { issueDate: "desc" },
    skip: meta.skip,
    take: meta.take,
  });

  const rows: QuoteListRow[] = quotes.map((q) => ({
    id: q.id,
    fullNumber: q.fullNumber,
    issueDate: q.issueDate.toISOString(),
    validUntil: q.validUntil?.toISOString() ?? null,
    status: q.status,
    notes: q.notes,
    discountPct: q.discountPct,
    subtotal: Number(q.subtotal),
    vatAmount: Number(q.vatAmount),
    total: Number(q.total),
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    primaryVatRate: primaryVatRate(q.lines.map((l) => l.vatRate)),
    clientName: q.client.name,
    clientNif: q.client.nif,
    invoiceId: q.invoice?.id ?? null,
  }));

  const params = { status: sp.status, clientId: sp.clientId };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Crea, envía y convierte en factura
          </p>
        </div>
        <Link href="/quotes/new" className="btn-primary">
          Nuevo presupuesto
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
          <option value="">Todos los estados</option>
          {["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "EXPIRADO"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <QuotesTable quotes={rows} />

      <Pagination
        basePath="/quotes"
        params={params}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.pageSize}
      />
    </div>
  );
}
