import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecurringForm } from "@/components/documents/RecurringForm";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, series, settings] = await Promise.all([
    prisma.recurringInvoiceTemplate.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, nif: true, email: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.invoiceSeries.findMany({ orderBy: { prefix: "asc" } }),
    prisma.companySettings.findFirst(),
  ]);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/recurring/${id}`}
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← {template.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar
        </h1>
      </div>
      <div className="card-panel p-6">
        <RecurringForm
          series={series.map((s) => ({
            id: s.id,
            name: s.name,
            prefix: s.prefix,
            isDefault: s.isDefault,
          }))}
          defaultClient={template.client}
          defaultVatRate={settings?.defaultVatRate ?? 21}
          defaultIrpfRate={settings?.defaultIrpfRate ?? 15}
          template={{
            id: template.id,
            name: template.name,
            clientId: template.clientId,
            seriesId: template.seriesId,
            frequency: template.frequency,
            intervalCount: template.intervalCount,
            dayOfMonth: template.dayOfMonth,
            startDate: template.startDate.toISOString().slice(0, 10),
            endDate: template.endDate
              ? template.endDate.toISOString().slice(0, 10)
              : "",
            notes: template.notes ?? "",
            paymentMethod: template.paymentMethod ?? "",
            bankIban: template.bankIban ?? "",
            irpfRate: template.irpfRate,
            vatOperationType: template.vatOperationType,
            cashAccounting: template.cashAccounting,
            operationKey: template.operationKey ?? "",
            operationKey347: template.operationKey347 ?? "",
            lines: template.lines.map((l) => ({
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
