import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { annulInvoice, deleteInvoice, setInvoiceStatus } from "../actions";
import { SendDocumentButton } from "@/components/documents/SendDocumentButton";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { orderBy: { sortOrder: "asc" } },
      quote: true,
      recurringTemplate: true,
    },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-ink-muted hover:text-accent">
            ← Facturas
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight">
            {invoice.fullNumber}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={invoice.status} />
            <span className="text-sm text-ink-muted">
              {invoice.client.name} · {formatDate(invoice.issueDate)}
            </span>
            {invoice.quote && (
              <Link
                href={`/quotes/${invoice.quote.id}`}
                className="text-sm text-accent hover:underline"
              >
                Origen: {invoice.quote.fullNumber}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.status !== "ANULADA" && (
            <>
              <SendDocumentButton kind="invoice" id={id} />
              <Link href={`/invoices/${id}/edit`} className="btn-secondary">
                Editar
              </Link>
            </>
          )}
          <Link
            href={`/api/invoices/${id}/pdf`}
            className="btn-primary"
            target="_blank"
          >
            Descargar PDF
          </Link>
        </div>
      </div>

      {invoice.status !== "ANULADA" && (
        <div className="flex flex-wrap gap-2">
          {invoice.status !== "PAGADA" && (
            <form action={setInvoiceStatus.bind(null, id, "PAGADA")}>
              <button type="submit" className="btn-secondary text-success">
                Marcar pagada
              </button>
            </form>
          )}
          {invoice.status === "PAGADA" && (
            <form action={setInvoiceStatus.bind(null, id, "PENDIENTE")}>
              <button type="submit" className="btn-secondary">
                Marcar pendiente
              </button>
            </form>
          )}
          <form action={annulInvoice.bind(null, id)}>
            <button type="submit" className="btn-ghost text-warning text-sm">
              Anular factura
            </button>
          </form>
        </div>
      )}

      <form action={deleteInvoice.bind(null, id)}>
        <button
          type="submit"
          className="btn-ghost text-danger text-sm"
          title="Si es la última de la serie, se reutiliza su número"
        >
          Eliminar factura
        </button>
      </form>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Concepto</th>
              <th className="px-4 py-2 text-right font-medium">Cant.</th>
              <th className="px-4 py-2 text-right font-medium">Precio</th>
              <th className="px-4 py-2 text-right font-medium">Dto</th>
              <th className="px-4 py-2 text-right font-medium">IVA</th>
              <th className="px-4 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id} className="border-b border-line/50">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {Number(l.quantity)}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(Number(l.unitPrice))}
                </td>
                <td className="px-4 py-2 text-right">{l.discountPct}%</td>
                <td className="px-4 py-2 text-right">{l.vatRate}%</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(Number(l.lineSubtotal))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end border-t border-line p-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Base imponible</span>
              <span className="font-mono">
                {formatCurrency(Number(invoice.subtotal))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">IVA</span>
              <span className="font-mono">
                {formatCurrency(Number(invoice.vatAmount))}
              </span>
            </div>
            {Number(invoice.irpfAmount) > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">
                  IRPF (−{invoice.irpfRate}%)
                </span>
                <span className="font-mono text-danger">
                  −{formatCurrency(Number(invoice.irpfAmount))}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1 font-semibold">
              <span>Total</span>
              <span className="font-mono">
                {formatCurrency(Number(invoice.total))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Al eliminar una factura se borra del sistema. Si era la última de la
        serie, su número ({invoice.fullNumber}) vuelve a quedar disponible.
        Anular la mantiene en el listado con el número reservado.
      </p>
    </div>
  );
}
