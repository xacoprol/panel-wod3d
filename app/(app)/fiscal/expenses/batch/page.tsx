import Link from "next/link";
import { ExpenseBatchReview } from "@/components/fiscal/ExpenseBatchReview";

export default function ExpenseBatchPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/fiscal/expenses"
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← Gastos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Revisar facturas
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Revisa los datos leídos y guarda las que estén bien. Las duplicadas se
          bloquean.
        </p>
      </div>
      <ExpenseBatchReview />
    </div>
  );
}
