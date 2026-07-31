import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { InvoiceImportReview } from "@/components/invoices/InvoiceImportReview";

export default async function InvoiceImportPage() {
  await requireAuth();
  const series = await prisma.invoiceSeries.findMany({
    orderBy: [{ isDefault: "desc" }, { prefix: "asc" }],
    select: { id: true, prefix: true, name: true, isDefault: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/invoices"
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← Facturas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Importar facturas históricas
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Revisa el número original, cliente e importes. Se empareja o crea el
          cliente y se actualiza el correlativo de la serie.
        </p>
      </div>
      <InvoiceImportReview series={series} />
    </div>
  );
}
