import Link from "next/link";
import { Suspense } from "react";
import { InlineSkeleton } from "@/components/ui/PageSkeleton";
import { prisma } from "@/lib/prisma";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { QuotesTable, type QuoteListRow } from "@/components/quotes/QuotesTable";
import { LiveSearch, LiveSelect } from "@/components/ui/LiveSearch";
import type { Prisma } from "@prisma/client";

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
  searchParams: Promise<{
    status?: string;
    clientId?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = sp.q?.trim();

  const where: Prisma.QuoteWhereInput = {
    ...(sp.status ? { status: sp.status } : {}),
    ...(sp.clientId ? { clientId: sp.clientId } : {}),
    ...(q
      ? {
          OR: [
            { fullNumber: { contains: q, mode: "insensitive" } },
            { client: { name: { contains: q, mode: "insensitive" } } },
            { client: { nif: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
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

  const rows: QuoteListRow[] = quotes.map((qrow) => ({
    id: qrow.id,
    fullNumber: qrow.fullNumber,
    issueDate: qrow.issueDate.toISOString(),
    validUntil: qrow.validUntil?.toISOString() ?? null,
    status: qrow.status,
    isProforma: qrow.isProforma,
    notes: qrow.notes,
    discountPct: qrow.discountPct,
    subtotal: Number(qrow.subtotal),
    vatAmount: Number(qrow.vatAmount),
    total: Number(qrow.total),
    createdAt: qrow.createdAt.toISOString(),
    updatedAt: qrow.updatedAt.toISOString(),
    primaryVatRate: primaryVatRate(qrow.lines.map((l) => l.vatRate)),
    clientName: qrow.client.name,
    clientNif: qrow.client.nif,
    invoiceId: qrow.invoice?.id ?? null,
  }));

  const params = { status: sp.status, clientId: sp.clientId, q: sp.q };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Presupuestos y proformas · convierte en factura cuando toque
          </p>
        </div>
        <Link href="/quotes/new" className="btn-primary">
          Nuevo presupuesto
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Suspense fallback={<InlineSkeleton />}>
          <LiveSearch placeholder="Buscar por nº, cliente o NIF…" />
        </Suspense>
        <Suspense fallback={null}>
          <LiveSelect
            param="status"
            allLabel="Todos los estados"
            options={["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "EXPIRADO"].map(
              (s) => ({ value: s, label: s })
            )}
          />
        </Suspense>
      </div>

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
