import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { QuoteForm } from "@/components/documents/QuoteForm";
import { previewNextQuoteNumber } from "@/lib/numbering";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const [clients, settings, nextNumber] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.companySettings.findFirst(),
    previewNextQuoteNumber(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/quotes" className="text-sm text-ink-muted hover:text-accent">
          ← Presupuestos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Nuevo presupuesto
        </h1>
        <p className="mt-1 font-mono text-sm text-ink-muted">
          Se asignará: {nextNumber}
        </p>
      </div>
      <div className="card-panel p-6">
        <QuoteForm
          clients={clients}
          defaultClientId={clientId}
          defaultVatRate={settings?.defaultVatRate ?? 21}
          nextNumberPreview={nextNumber}
        />
      </div>
    </div>
  );
}
