import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/components/documents/InvoiceForm";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, series, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.invoiceSeries.findMany({ orderBy: { prefix: "asc" } }),
    prisma.companySettings.findFirst(),
  ]);
  if (!invoice) notFound();
  if (invoice.status === "ANULADA") {
    return (
      <div className="space-y-4">
        <p>Las facturas anuladas no se pueden editar.</p>
        <Link href={`/invoices/${id}`} className="btn-secondary">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/invoices/${id}`}
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← {invoice.fullNumber}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar factura
        </h1>
      </div>
      <div className="card-panel p-6">
        <InvoiceForm
          clients={clients}
          series={series.map((s) => ({
            id: s.id,
            name: s.name,
            prefix: s.prefix,
          }))}
          defaultVatRate={settings?.defaultVatRate ?? 21}
          defaultIrpfRate={settings?.defaultIrpfRate ?? 15}
          invoice={{
            id: invoice.id,
            clientId: invoice.clientId,
            seriesId: invoice.seriesId,
            fullNumber: invoice.fullNumber,
            issueDate: invoice.issueDate.toISOString().slice(0, 10),
            dueDate: invoice.dueDate
              ? invoice.dueDate.toISOString().slice(0, 10)
              : "",
            status: invoice.status,
            paymentMethod: invoice.paymentMethod ?? "",
            notes: invoice.notes ?? "",
            irpfRate: invoice.irpfRate,
            lines: invoice.lines.map((l) => ({
              id: l.id,
              description: l.description,
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              vatRate: l.vatRate,
              discountPct: l.discountPct,
            })),
          }}
        />
      </div>
    </div>
  );
}
