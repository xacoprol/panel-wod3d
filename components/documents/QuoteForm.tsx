"use client";

import { useActionState, useMemo, useState } from "react";
import {
  LineItemsEditor,
  createEmptyLines,
  type EditorLine,
} from "@/components/documents/LineItemsEditor";
import {
  DocumentFormSection,
  DocumentFormShell,
  DocumentFormStickyBar,
} from "@/components/documents/DocumentFormShell";
import { ClientCombobox, type ClientOption } from "@/components/clients/ClientCombobox";
import { createQuote, updateQuote, type DocFormState } from "@/app/(app)/quotes/actions";
import { DateInput } from "@/components/ui/DateInput";
import { calculateDocument, formatCurrency } from "@/lib/calculations";

type QuoteData = {
  id: string;
  clientId: string;
  issueDate: string;
  validUntil: string;
  status: string;
  isProforma: boolean;
  notes: string;
  conditions: string;
  discountPct: number;
  lines: EditorLine[];
  fullNumber?: string;
};

type Props = {
  defaultClient?: ClientOption | null;
  defaultVatRate?: number;
  quote?: QuoteData;
  nextNumberPreview?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function QuoteForm({
  defaultClient = null,
  defaultVatRate = 21,
  quote,
  nextNumberPreview,
}: Props) {
  const action = quote
    ? updateQuote.bind(null, quote.id)
    : createQuote;

  const [state, formAction, pending] = useActionState<DocFormState, FormData>(
    action,
    {}
  );
  const [lines, setLines] = useState<EditorLine[]>(
    quote?.lines ?? createEmptyLines(defaultVatRate)
  );
  const [discountPct, setDiscountPct] = useState(quote?.discountPct ?? 0);
  const [isProforma, setIsProforma] = useState(quote?.isProforma ?? false);

  const totals = useMemo(
    () => calculateDocument(lines, 0, discountPct),
    [lines, discountPct]
  );

  const numberLabel =
    quote?.fullNumber ?? nextNumberPreview ?? undefined;
  const kindLabel = isProforma ? "Proforma" : "Presupuesto";

  return (
    <form action={formAction}>
      <DocumentFormShell
        docKind={kindLabel}
        numberLabel={numberLabel}
        subtitle={
          quote
            ? "Modifica los datos y guarda los cambios"
            : "El número se asignará al guardar"
        }
      >
        {state.error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}

        <DocumentFormSection
          title="Datos"
          hint="Cliente, fechas y estado del documento"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ClientCombobox defaultClient={defaultClient} />
            </div>
            <div>
              <label className="label" htmlFor="issueDate">
                Fecha emisión
              </label>
              <DateInput
                id="issueDate"
                name="issueDate"
                className="input"
                required
                defaultValue={quote?.issueDate ?? todayISO()}
              />
            </div>
            <div>
              <label className="label" htmlFor="validUntil">
                Válido hasta
              </label>
              <DateInput
                id="validUntil"
                name="validUntil"
                className="input"
                defaultValue={quote?.validUntil ?? plusDaysISO(30)}
              />
            </div>
            <div>
              <label className="label" htmlFor="status">
                Estado
              </label>
              <select
                id="status"
                name="status"
                className="input"
                defaultValue={quote?.status ?? "BORRADOR"}
              >
                {["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "EXPIRADO"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isProforma"
                  value="1"
                  checked={isProforma}
                  onChange={(e) => setIsProforma(e.target.checked)}
                  className="mt-0.5 rounded border-line"
                />
                <span>
                  <span className="font-medium">Emitir como proforma</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    Mismo documento y numeración; el PDF y el email salen como
                    «Proforma» (no es factura fiscal).
                  </span>
                </span>
              </label>
            </div>
          </div>
        </DocumentFormSection>

        <DocumentFormSection
          title="Conceptos"
          hint={`Líneas del ${kindLabel.toLowerCase()} y descuento general`}
        >
          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            defaultVatRate={defaultVatRate}
            showGlobalDiscount
            globalDiscountPct={discountPct}
            onGlobalDiscountChange={setDiscountPct}
          />
        </DocumentFormSection>

        <DocumentFormSection title="Notas y condiciones">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="notes">
                Notas
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="input"
                placeholder="Observaciones visibles en el documento…"
                defaultValue={quote?.notes ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="conditions">
                Condiciones
              </label>
              <textarea
                id="conditions"
                name="conditions"
                rows={4}
                className="input"
                placeholder="Condiciones de aceptación, plazos…"
                defaultValue={quote?.conditions ?? ""}
              />
            </div>
          </div>
        </DocumentFormSection>
      </DocumentFormShell>

      <DocumentFormStickyBar
        totalLabel={isProforma ? "Total proforma" : "Total presupuesto"}
        totalValue={formatCurrency(totals.total)}
      >
        <a href="/quotes" className="btn-secondary">
          Cancelar
        </a>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Guardando…"
            : quote
              ? "Guardar cambios"
              : isProforma
                ? "Crear proforma"
                : "Crear presupuesto"}
        </button>
      </DocumentFormStickyBar>
    </form>
  );
}
