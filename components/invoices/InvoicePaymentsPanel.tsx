import { formatCurrency, formatDate } from "@/lib/calculations";
import {
  addInvoicePayment,
  deleteInvoicePayment,
} from "@/app/(app)/invoices/actions";

type Payment = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
};

type Props = {
  invoiceId: string;
  total: number;
  paid: number;
  remaining: number;
  defaultMethod: string;
  payments: Payment[];
  disabled?: boolean;
};

export function InvoicePaymentsPanel({
  invoiceId,
  total,
  paid,
  remaining,
  defaultMethod,
  payments,
  disabled,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="card-panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="form-section-title">Cobros</h2>
          <p className="form-section-hint">
            Registra pagos parciales o totales. El estado se actualiza solo.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-muted">Total</p>
            <p className="font-mono font-medium">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Cobrado</p>
            <p className="font-mono font-medium text-success">
              {formatCurrency(paid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Pendiente</p>
            <p className="font-mono font-medium text-accent">
              {formatCurrency(remaining)}
            </p>
          </div>
        </div>
      </div>

      {payments.length > 0 ? (
        <ul className="divide-y divide-line/60 rounded-lg border border-line">
          {payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div>
                <span className="font-mono font-medium">
                  {formatCurrency(p.amount)}
                </span>
                <span className="mx-2 text-ink-muted">·</span>
                <span className="text-ink-muted">{formatDate(p.paidAt)}</span>
                {p.method ? (
                  <span className="text-ink-muted"> · {p.method}</span>
                ) : null}
                {p.notes ? (
                  <p className="text-xs text-ink-muted">{p.notes}</p>
                ) : null}
              </div>
              {!disabled ? (
                <form action={deleteInvoicePayment.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="btn-ghost px-2 py-1 text-xs text-danger"
                  >
                    Eliminar
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Sin cobros registrados.</p>
      )}

      {!disabled && remaining > 0.001 ? (
        <form
          action={addInvoicePayment.bind(null, invoiceId)}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label className="label" htmlFor="amount">
              Importe
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              required
              defaultValue={remaining.toFixed(2)}
              className="input font-mono"
            />
          </div>
          <div>
            <label className="label" htmlFor="paidAt">
              Fecha
            </label>
            <input
              id="paidAt"
              name="paidAt"
              type="date"
              defaultValue={today}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="method">
              Método
            </label>
            <input
              id="method"
              name="method"
              className="input"
              defaultValue={defaultMethod}
              placeholder="Transferencia"
            />
          </div>
          <div>
            <label className="label" htmlFor="notes">
              Nota
            </label>
            <input
              id="notes"
              name="notes"
              className="input"
              placeholder="Opcional"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              Registrar cobro
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
