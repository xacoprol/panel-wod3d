"use client";

import { useActionState, useState } from "react";
import {
  LineItemsEditor,
  createEmptyLines,
  type EditorLine,
} from "@/components/documents/LineItemsEditor";
import { createQuote, updateQuote, type DocFormState } from "@/app/(app)/quotes/actions";

type ClientOption = { id: string; name: string };
type QuoteData = {
  id: string;
  clientId: string;
  issueDate: string;
  validUntil: string;
  status: string;
  notes: string;
  conditions: string;
  lines: EditorLine[];
};

type Props = {
  clients: ClientOption[];
  defaultClientId?: string;
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
  clients,
  defaultClientId,
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

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label">Número</label>
          <p className="py-2 font-mono text-sm">
            {quote ? "Se mantiene al editar" : nextNumberPreview ?? "Automático"}
          </p>
        </div>
        <div>
          <label className="label" htmlFor="clientId">
            Cliente
          </label>
          <select
            id="clientId"
            name="clientId"
            className="input"
            required
            defaultValue={quote?.clientId ?? defaultClientId ?? ""}
          >
            <option value="">Seleccionar…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="issueDate">
            Fecha emisión
          </label>
          <input
            type="date"
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
          <input
            type="date"
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
      </div>

      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        defaultVatRate={defaultVatRate}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="notes">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="input"
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
            rows={3}
            className="input"
            defaultValue={quote?.conditions ?? ""}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Guardando…"
            : quote
              ? "Guardar cambios"
              : "Crear presupuesto"}
        </button>
        <a href="/quotes" className="btn-secondary">
          Cancelar
        </a>
      </div>
    </form>
  );
}
