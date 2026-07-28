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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/quotes/${id}`} className="text-sm text-ink-muted hover:text-accent">
          ← {quote.fullNumber}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar presupuesto
        </h1>
      </div>
      <div className="card-panel p-6">
        <QuoteForm
          clients={clients}
          defaultVatRate={settings?.defaultVatRate ?? 21}
          quote={{
            id: quote.id,
            clientId: quote.clientId,
            issueDate: quote.issueDate.toISOString().slice(0, 10),
            validUntil: quote.validUntil
              ? quote.validUntil.toISOString().slice(0, 10)
              : "",
            status: quote.status,
            notes: quote.notes ?? "",
            conditions: quote.conditions ?? "",
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
    </div>
  );
}
