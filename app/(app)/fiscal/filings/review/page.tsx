import Link from "next/link";
import { FilingBatchReview } from "@/components/fiscal/FilingBatchReview";

export default function FiscalFilingsReviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/fiscal/filings"
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← Presentados
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Revisar modelos leídos
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Corrige tipo, periodo y casillas antes de guardar. Si ya existe el
          mismo periodo, se actualiza.
        </p>
      </div>
      <FilingBatchReview />
    </div>
  );
}
