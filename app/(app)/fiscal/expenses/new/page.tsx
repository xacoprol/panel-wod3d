import Link from "next/link";
import { ExpenseForm } from "@/components/fiscal/ExpenseForm";

export default function NewExpensePage() {
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
          Nuevo gasto
        </h1>
      </div>
      <ExpenseForm />
    </div>
  );
}
