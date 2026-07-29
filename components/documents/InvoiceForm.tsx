"use client";

import { useActionState, useState } from "react";
import {
  LineItemsEditor,
  createEmptyLines,
  type EditorLine,
} from "@/components/documents/LineItemsEditor";
import {
  createInvoice,
  updateInvoice,
  type DocFormState,
} from "@/app/(app)/invoices/actions";

type ClientOption = { id: string; name: string };
type SeriesOption = {
  id: string;
  name: string;
  prefix: string;
  isDefault?: boolean;
  nextNumberPreview?: string;
};

type InvoiceData = {
  id: string;
  clientId: string;
  seriesId: string;
  fullNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  paymentMethod: string;
  notes: string;
  irpfRate: number;
  lines: EditorLine[];
};

type Props = {
  clients: ClientOption[];
  series: SeriesOption[];
  defaultClientId?: string;
  defaultVatRate?: number;
  defaultIrpfRate?: number;
  invoice?: InvoiceData;
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

export function InvoiceForm({
  clients,
  series,
  defaultClientId,
  defaultVatRate = 21,
  defaultIrpfRate = 15,
  invoice,
  nextNumberPreview,
}: Props) {
  const action = invoice
    ? updateInvoice.bind(null, invoice.id)
    : createInvoice;

  const [state, formAction, pending] = useActionState<DocFormState, FormData>(
    action,
    {}
  );
  const [lines, setLines] = useState<EditorLine[]>(
    invoice?.lines ?? createEmptyLines(defaultVatRate)
  );
  const [irpfRate, setIrpfRate] = useState(
    invoice?.irpfRate ?? defaultIrpfRate
  );
  const defaultSeriesId =
    series.find((s) => s.isDefault)?.id ?? series[0]?.id ?? "";
  const [selectedSeriesId, setSelectedSeriesId] = useState(defaultSeriesId);
  const selectedSeries = series.find((s) => s.id === selectedSeriesId);
  const preview =
    selectedSeries?.nextNumberPreview ?? nextNumberPreview;

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!invoice && (
          <div>
            <label className="label" htmlFor="seriesId">
              Serie
            </label>
            <select
              id="seriesId"
              name="seriesId"
              className="input"
              value={selectedSeriesId}
              onChange={(e) => setSelectedSeriesId(e.target.value)}
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.prefix})
                </option>
              ))}
            </select>
            <p className="mt-1 font-mono text-xs text-ink-muted">
              Próximo: {preview}
            </p>
          </div>
        )}
        {invoice && (
          <div>
            <label className="label">Número</label>
            <p className="font-mono text-sm py-2">{invoice.fullNumber}</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="clientId">
            Cliente
          </label>
          <select
            id="clientId"
            name="clientId"
            className="input"
            required
            defaultValue={invoice?.clientId ?? defaultClientId ?? ""}
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
            defaultValue={invoice?.issueDate ?? todayISO()}
          />
        </div>
        <div>
          <label className="label" htmlFor="dueDate">
            Vencimiento
          </label>
          <input
            type="date"
            id="dueDate"
            name="dueDate"
            className="input"
            defaultValue={invoice?.dueDate ?? plusDaysISO(30)}
          />
        </div>
        {invoice && (
          <div>
            <label className="label" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              className="input"
              defaultValue={invoice.status}
            >
              {["PENDIENTE", "PAGADA", "VENCIDA", "ANULADA"].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="paymentMethod">
            Método de pago
          </label>
          <input
            id="paymentMethod"
            name="paymentMethod"
            className="input"
            placeholder="Transferencia, efectivo…"
            defaultValue={invoice?.paymentMethod ?? ""}
          />
        </div>
      </div>

      <LineItemsEditor
        lines={lines}
        onChange={setLines}
        irpfRate={irpfRate}
        onIrpfChange={setIrpfRate}
        showIrpf
        defaultVatRate={defaultVatRate}
      />

      <div>
        <label className="label" htmlFor="notes">
          Notas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="input"
          defaultValue={invoice?.notes ?? ""}
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Guardando…"
            : invoice
              ? "Guardar cambios"
              : "Emitir factura"}
        </button>
        <a href="/invoices" className="btn-secondary">
          Cancelar
        </a>
      </div>
    </form>
  );
}
