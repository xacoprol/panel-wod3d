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
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.companySettings.findFirst(),
    previewNextQuoteNumber(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/quotes"
        className="inline-block text-sm text-ink-muted hover:text-accent"
      >
        ← Presupuestos
      </Link>
      <QuoteForm
        clients={clients}
        defaultClientId={clientId}
        defaultVatRate={settings?.defaultVatRate ?? 21}
        nextNumberPreview={nextNumber}
      />
    </div>
  );
}
