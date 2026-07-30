"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { Expense } from "@prisma/client";
import { VAT_RATES } from "@/lib/calculations";
import { EXPENSE_CATEGORIES } from "@/lib/fiscal";
import { DateInput } from "@/components/ui/DateInput";
import { ExpenseDropZone } from "@/components/fiscal/ExpenseDropZone";
import {
  createExpense,
  updateExpense,
  type ExpenseFormState,
} from "@/app/(app)/fiscal/expenses/actions";
import type { ParsedExpenseDraft } from "@/lib/gemini-expense";
import { consumeExpenseDraft } from "@/lib/expense-draft-storage";
import { ButtonPending } from "@/components/ui/ButtonPending";

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

  const [issueDate, setIssueDate] = useState(
    expense
      ? toDateInputValue(expense.issueDate)
      : toDateInputValue(new Date())
  );
  const [category, setCategory] = useState(expense?.category ?? "OTROS");
  const [supplierName, setSupplierName] = useState(
    expense?.supplierName ?? ""
  );
  const [supplierNif, setSupplierNif] = useState(expense?.supplierNif ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(
    expense?.invoiceNumber ?? ""
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [subtotal, setSubtotal] = useState(
    expense ? Number(expense.subtotal) : 0
  );
  const [vatRate, setVatRate] = useState(expense?.vatRate ?? 21);
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [deductible, setDeductible] = useState(expense?.deductible ?? true);
  const [dateKey, setDateKey] = useState(0);
  const [parseInfo, setParseInfo] = useState<string | null>(null);

  const vatAmount = useMemo(
    () => Math.round(subtotal * (vatRate / 100) * 100) / 100,
    [subtotal, vatRate]
  );
  const total = useMemo(
    () => Math.round((subtotal + vatAmount) * 100) / 100,
    [subtotal, vatAmount]
  );

  function applyDraft(draft: ParsedExpenseDraft) {
    setIssueDate(draft.issueDate);
    setDateKey((k) => k + 1);
    setCategory(draft.category);
    setSupplierName(draft.supplierName);
    setSupplierNif(draft.supplierNif ?? "");
    setInvoiceNumber(draft.invoiceNumber ?? "");
    setDescription(draft.description ?? "");
    setSubtotal(draft.subtotal);
    setVatRate(draft.vatRate);
    setNotes(draft.notes ?? "");
    const conf =
      draft.confidence === "high"
        ? "alta"
        : draft.confidence === "low"
          ? "baja"
          : "media";
    setParseInfo(
      `Datos rellenados (confianza ${conf}). Revísalos antes de guardar.`
    );
  }

  useEffect(() => {
    if (expense) return;
    const draft = consumeExpenseDraft();
    if (draft) applyDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [expense]);

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-5">
      {state.error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
          {state.duplicateId ? (
            <>
              {" "}
              <Link
                href={`/fiscal/expenses/${state.duplicateId}/edit`}
                className="font-medium underline"
              >
                Abrir el existente
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {!expense ? (
        <section className="space-y-3">
          <ExpenseDropZone compact onParsed={applyDraft} />
          {parseInfo ? (
            <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              {parseInfo}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card-panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="form-section-title">
            {expense ? "Editar gasto" : "Datos del gasto"}
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
              key={dateKey}
              id="issueDate"
              name="issueDate"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
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
              value={supplierNif}
              onChange={(e) => setSupplierNif(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="invoiceNumber">
            Nº factura proveedor
          </label>
          <input
            id="invoiceNumber"
            name="invoiceNumber"
            className="input font-mono"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Ej. F-2026-0042"
          />
          <p className="mt-1 text-xs text-ink-muted">
            Si se registra dos veces la misma factura del mismo proveedor, se
            bloquea el alta.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Concepto
          </label>
          <input
            id="description"
            name="description"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
              onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)}
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
            checked={deductible}
            onChange={(e) => setDeductible(e.target.checked)}
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        <ButtonPending
          pending={pending}
          idle={expense ? "Guardar cambios" : "Registrar gasto"}
          busy="Guardando…"
        />
      </button>
    </form>
  );
}
