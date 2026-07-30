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
import {
  createInvoice,
  updateInvoice,
  type DocFormState,
} from "@/app/(app)/invoices/actions";
import { DateInput } from "@/components/ui/DateInput";
import { calculateDocument, formatCurrency } from "@/lib/calculations";
import {
  isZeroVatOperation,
  VAT_OPERATION_TYPES,
} from "@/lib/recurring";

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
  vatOperationType: string;
  lines: EditorLine[];
};

type Props = {
  series: SeriesOption[];
  defaultClient?: ClientOption | null;
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
  series,
  defaultClient = null,
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
  const [vatOperationType, setVatOperationType] = useState(
    invoice?.vatOperationType ?? "SUJETA"
  );
  const defaultSeriesId =
    series.find((s) => s.isDefault)?.id ?? series[0]?.id ?? "";
  const [selectedSeriesId, setSelectedSeriesId] = useState(
    invoice?.seriesId ?? defaultSeriesId
  );
  const selectedSeries = series.find((s) => s.id === selectedSeriesId);
  const preview =
    selectedSeries?.nextNumberPreview ?? nextNumberPreview;

  const totals = useMemo(
    () => calculateDocument(lines, irpfRate),
    [lines, irpfRate]
  );

  function onVatOperationChange(next: string) {
    setVatOperationType(next);
    if (isZeroVatOperation(next)) {
      setLines((prev) => prev.map((l) => ({ ...l, vatRate: 0 })));
    } else {
      setLines((prev) =>
        prev.map((l) =>
          l.vatRate === 0 ? { ...l, vatRate: defaultVatRate } : l
        )
      );
    }
  }

  const numberLabel = invoice?.fullNumber ?? preview ?? undefined;

  return (
    <form action={formAction}>
      <DocumentFormShell
        docKind="Factura"
        numberLabel={numberLabel}
        subtitle={
          invoice
            ? "Modifica los datos y guarda los cambios"
            : "El número se reserva al guardar (correlativo sin huecos)"
        }
      >
        {state.error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}

        <DocumentFormSection
          title="Datos"
          hint="Serie, cliente, fechas y cobro"
        >
          <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
            )}
            <div className={invoice ? "sm:col-span-2" : undefined}>
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
                defaultValue={invoice?.issueDate ?? todayISO()}
              />
            </div>
            <div>
              <label className="label" htmlFor="dueDate">
                Vencimiento
              </label>
              <DateInput
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
            <div className={invoice ? undefined : "sm:col-span-2"}>
              <label className="label" htmlFor="paymentMethod">
                Método de pago
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className="input"
                defaultValue={
                  invoice?.paymentMethod?.toLowerCase().includes("bizum")
                    ? "Bizum"
                    : "Transferencia"
                }
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Bizum">Bizum</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Transferencia: IBAN de Ajustes · Bizum: teléfono configurado en
                Ajustes
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="vatOperationType">
                Tipo de operación IVA
              </label>
              <select
                id="vatOperationType"
                name="vatOperationType"
                className="input"
                value={vatOperationType}
                onChange={(e) => onVatOperationChange(e.target.value)}
              >
                {VAT_OPERATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Intracomunitaria y Canarias no llevan IVA peninsular (0 %). Así
                Fiscal las separa del IVA repercutido del 303.
              </p>
            </div>
          </div>
        </DocumentFormSection>

        <DocumentFormSection
          title="Conceptos"
          hint="Líneas de la factura e IRPF"
        >
          <LineItemsEditor
            lines={lines}
            onChange={setLines}
            irpfRate={irpfRate}
            onIrpfChange={setIrpfRate}
            showIrpf
            defaultVatRate={defaultVatRate}
          />
        </DocumentFormSection>

        <DocumentFormSection title="Notas">
          <label className="label" htmlFor="notes">
            Observaciones
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            className="input"
            placeholder="Notas visibles en la factura…"
            defaultValue={invoice?.notes ?? ""}
          />
        </DocumentFormSection>
      </DocumentFormShell>

      <DocumentFormStickyBar
        totalLabel="Total factura"
        totalValue={formatCurrency(totals.total)}
      >
        <a href="/invoices" className="btn-secondary">
          Cancelar
        </a>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Guardando…"
            : invoice
              ? "Guardar cambios"
              : "Emitir factura"}
        </button>
      </DocumentFormStickyBar>
    </form>
  );
}
