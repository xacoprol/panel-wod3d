import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, calculateDocument } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { convertQuoteToInvoice } from "../actions";
import { SendDocumentButton } from "@/components/documents/SendDocumentButton";
import { DeleteQuoteButton } from "@/components/quotes/DeleteQuoteButton";
import { quoteKindLabel } from "@/lib/quote-kind";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
      invoice: true,
    },
  });
  if (!quote) notFound();

  const kind = quoteKindLabel(quote.isProforma);

  const totals = calculateDocument(
    quote.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      vatRate: l.vatRate,
      discountPct: l.discountPct,
    })),
    0,
    quote.discountPct
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/quotes" className="text-sm text-ink-muted hover:text-accent">
            ← Presupuestos
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            {quote.fullNumber}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {quote.isProforma ? (
              <span className="badge bg-accent-soft text-accent">Proforma</span>
            ) : null}
            <StatusBadge status={quote.status} />
            <span className="text-sm text-ink-muted">
              {quote.client.name} · {formatDate(quote.issueDate)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!quote.invoice && (
            <>
              <SendDocumentButton kind="quote" id={id} />
              <Link href={`/quotes/${id}/edit`} className="btn-secondary">
                Editar
              </Link>
              <form action={convertQuoteToInvoice.bind(null, id)}>
                <button type="submit" className="btn-primary">
                  Convertir en factura
                </button>
              </form>
            </>
          )}
          {quote.invoice && (
            <Link href={`/invoices/${quote.invoice.id}`} className="btn-primary">
              Ver factura {quote.invoice.fullNumber}
            </Link>
          )}
          <Link href={`/api/quotes/${id}/pdf`} className="btn-secondary" target="_blank">
            PDF {kind}
          </Link>
          {!quote.invoice && (
            <DeleteQuoteButton
              quoteId={id}
              fullNumber={quote.fullNumber}
              kindLabel={kind.toLowerCase()}
            />
          )}
        </div>
      </div>

      <div className="card-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Concepto</th>
              <th className="px-4 py-2 text-right font-medium">Cant.</th>
              <th className="px-4 py-2 text-right font-medium">Precio</th>
              <th className="px-4 py-2 text-right font-medium">IVA</th>
              <th className="px-4 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l) => (
              <tr key={l.id} className="border-b border-line/50">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(l.quantity)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(Number(l.unitPrice))}
                </td>
                <td className="px-4 py-2 text-right">{l.vatRate}%</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(Number(l.lineSubtotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-line p-4">
          <div className="w-56 space-y-1 text-sm">
            {totals.discountAmount > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Base bruta</span>
                  <span className="font-mono">
                    {formatCurrency(totals.grossSubtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">
                    Dto. general (−{totals.discountPct}%)
                  </span>
                  <span className="font-mono text-danger">
                    −{formatCurrency(totals.discountAmount)}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between">
              <span className="text-ink-muted">Base</span>
              <span className="font-mono">{formatCurrency(Number(quote.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">IVA</span>
              <span className="font-mono">{formatCurrency(Number(quote.vatAmount))}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(Number(quote.total))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
