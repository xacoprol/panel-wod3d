import Link from "next/link";
import { MarketplaceIncomeImportReview } from "@/components/fiscal/MarketplaceIncomeImportReview";

export default function MarketplaceIncomeImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/fiscal/income"
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← Ingresos marketplace
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Revisar importación
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Comprueba bases e IVA antes de guardar. En Shopify puedes ajustar la
          fecha del periodo.
        </p>
      </div>
      <MarketplaceIncomeImportReview />
    </div>
  );
}
