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
  const [settings, nextNumber, defaultClient] = await Promise.all([
    prisma.companySettings.findFirst(),
    previewNextQuoteNumber(),
    clientId
      ? prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true, nif: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <Link
        href="/quotes"
        className="inline-block text-sm text-ink-muted hover:text-accent"
      >
        ← Presupuestos
      </Link>
      <QuoteForm
        defaultClient={defaultClient}
        defaultVatRate={settings?.defaultVatRate ?? 21}
        nextNumberPreview={nextNumber}
      />
    </div>
  );
}
