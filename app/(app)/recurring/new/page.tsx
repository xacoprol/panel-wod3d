import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RecurringForm } from "@/components/documents/RecurringForm";

export default async function NewRecurringPage() {
  const [clients, series, settings] = await Promise.all([
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.invoiceSeries.findMany({ orderBy: { prefix: "asc" } }),
    prisma.companySettings.findFirst(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/recurring" className="text-sm text-ink-muted hover:text-accent">
          ← Periódicas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Nueva plantilla periódica
        </h1>
      </div>
      <div className="card-panel p-6">
        <RecurringForm
          clients={clients}
          series={series.map((s) => ({
            id: s.id,
            name: s.name,
            prefix: s.prefix,
          }))}
          defaultVatRate={settings?.defaultVatRate ?? 21}
          defaultIrpfRate={settings?.defaultIrpfRate ?? 15}
        />
      </div>
    </div>
  );
}
