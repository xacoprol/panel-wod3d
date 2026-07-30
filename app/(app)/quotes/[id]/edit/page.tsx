import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/documents/QuoteForm";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: { lines: { orderBy: { sortOrder: "asc" } }, invoice: true },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.companySettings.findFirst(),
  ]);
  if (!quote) notFound();
  if (quote.invoice) {
    return (
      <div className="space-y-4">
        <p>Este presupuesto ya se convirtió en factura y no se puede editar.</p>
        <Link href={`/quotes/${id}`} className="btn-secondary">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href={`/quotes/${id}`}
        className="inline-block text-sm text-ink-muted hover:text-accent"
      >
        ← Volver al presupuesto
      </Link>
      <QuoteForm
        clients={clients}
        defaultVatRate={settings?.defaultVatRate ?? 21}
        quote={{
          id: quote.id,
          fullNumber: quote.fullNumber,
          clientId: quote.clientId,
          issueDate: quote.issueDate.toISOString().slice(0, 10),
          validUntil: quote.validUntil
            ? quote.validUntil.toISOString().slice(0, 10)
            : "",
          status: quote.status,
          notes: quote.notes ?? "",
          conditions: quote.conditions ?? "",
          discountPct: quote.discountPct,
          lines: quote.lines.map((l) => ({
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
  );
}
