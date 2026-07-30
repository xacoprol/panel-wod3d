"use client";

import { useActionState, useMemo, useState } from "react";
import type { Expense } from "@prisma/client";
import { VAT_RATES } from "@/lib/calculations";
import { EXPENSE_CATEGORIES } from "@/lib/fiscal";
import { DateInput } from "@/components/ui/DateInput";
import {
  createExpense,
  updateExpense,
  type ExpenseFormState,
} from "@/app/(app)/fiscal/expenses/actions";

type Props = {
  expense?: Expense;
};

function toDateInputValue(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function ExpenseForm({ expense }: Props) {
  const action = expense
    ? updateExpense.bind(null, expense.id)
    : createExpense;
  const [state, formAction, pending] = useActionState<
    ExpenseFormState,
    FormData
  >(action, {});

  const [subtotal, setSubtotal] = useState(
    expense ? Number(expense.subtotal) : 0
  );
  const [vatRate, setVatRate] = useState(expense?.vatRate ?? 21);

  const vatAmount = useMemo(
    () => Math.round(subtotal * (vatRate / 100) * 100) / 100,
    [subtotal, vatRate]
  );
  const total = useMemo(
    () => Math.round((subtotal + vatAmount) * 100) / 100,
    [subtotal, vatAmount]
  );

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-5">
      {state.error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <section className="card-panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="form-section-title">
            {expense ? "Editar gasto" : "Nuevo gasto"}
          </h2>
          <p className="form-section-hint">
            Factura recibida o ticket. Entra en el IVA soportado (303) y en el
            130 si es deducible.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="issueDate">
              Fecha
            </label>
            <DateInput
              id="issueDate"
              name="issueDate"
              required
              defaultValue={
                expense
                  ? toDateInputValue(expense.issueDate)
                  : toDateInputValue(new Date())
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="category">
              Categoría
            </label>
            <select
              id="category"
              name="category"
              className="input"
              defaultValue={expense?.category ?? "OTROS"}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="supplierName">
              Proveedor
            </label>
            <input
              id="supplierName"
              name="supplierName"
              className="input"
              required
              defaultValue={expense?.supplierName ?? ""}
              placeholder="Nombre o razón social"
            />
          </div>
          <div>
            <label className="label" htmlFor="supplierNif">
              NIF proveedor
            </label>
            <input
              id="supplierNif"
              name="supplierNif"
              className="input font-mono"
              defaultValue={expense?.supplierNif ?? ""}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Concepto
          </label>
          <input
            id="description"
            name="description"
            className="input"
            defaultValue={expense?.description ?? ""}
            placeholder="Ej. Hosting Vercel julio"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="subtotal">
              Base imponible
            </label>
            <input
              id="subtotal"
              name="subtotal"
              type="number"
              step="0.01"
              min="0"
              required
              className="input font-mono"
              value={subtotal}
              onChange={(e) =>
                setSubtotal(parseFloat(e.target.value) || 0)
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="vatRate">
              IVA %
            </label>
            <select
              id="vatRate"
              name="vatRate"
              className="input"
              value={vatRate}
              onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
            >
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="vatAmount">
              Cuota IVA
            </label>
            <input
              id="vatAmount"
              name="vatAmount"
              type="number"
              step="0.01"
              min="0"
              className="input font-mono"
              value={vatAmount}
              readOnly
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="total">
            Total
          </label>
          <input
            id="total"
            name="total"
            type="number"
            step="0.01"
            className="input font-mono"
            value={total}
            readOnly
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="deductible"
            value="1"
            defaultChecked={expense?.deductible ?? true}
            className="rounded border-line"
          />
          Deducible (IVA soportado y gasto en modelo 130)
        </label>

        <div>
          <label className="label" htmlFor="notes">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            className="input min-h-20"
            defaultValue={expense?.notes ?? ""}
            placeholder="Opcional"
          />
        </div>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : expense ? "Guardar cambios" : "Registrar gasto"}
      </button>
    </form>
  );
}
