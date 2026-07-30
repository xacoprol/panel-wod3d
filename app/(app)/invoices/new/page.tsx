import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InvoiceForm } from "@/components/documents/InvoiceForm";
import { previewNextInvoiceNumber } from "@/lib/numbering";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const [series, settings, defaultClient] = await Promise.all([
    prisma.invoiceSeries.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.companySettings.findFirst(),
    clientId
      ? prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true, nif: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const seriesOptions = await Promise.all(
    series.map(async (s) => ({
      id: s.id,
      name: s.name,
      prefix: s.prefix,
      isDefault: s.isDefault,
      nextNumberPreview: await previewNextInvoiceNumber(s.id),
    }))
  );

  const defaultSeries =
    seriesOptions.find((s) => s.isDefault) ?? seriesOptions[0];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/invoices"
        className="inline-block text-sm text-ink-muted hover:text-accent"
      >
        ← Facturas
      </Link>
      <InvoiceForm
        series={seriesOptions}
        defaultClient={defaultClient}
        defaultVatRate={settings?.defaultVatRate ?? 21}
        defaultIrpfRate={settings?.defaultIrpfRate ?? 15}
        nextNumberPreview={defaultSeries?.nextNumberPreview}
      />
    </div>
  );
}
