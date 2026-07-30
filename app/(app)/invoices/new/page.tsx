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
  const [clients, series, settings] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.invoiceSeries.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.companySettings.findFirst(),
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
        clients={clients}
        series={seriesOptions}
        defaultClientId={clientId}
        defaultVatRate={settings?.defaultVatRate ?? 21}
        defaultIrpfRate={settings?.defaultIrpfRate ?? 15}
        nextNumberPreview={defaultSeries?.nextNumberPreview}
      />
    </div>
  );
}
