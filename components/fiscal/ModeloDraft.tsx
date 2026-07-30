import Link from "next/link";
import { formatCurrency } from "@/lib/calculations";
import type { FiscalPeriodSummary } from "@/lib/fiscal";

type Props = {
  title: string;
  model: "303" | "130";
  summary: FiscalPeriodSummary;
};

export function ModeloDraft({ title, model, summary }: Props) {
  const draft = model === "303" ? summary.modelo303 : summary.modelo130;
  const missingExpenses = summary.expenses.count === 0;
  const resultPositive = draft.result >= 0;

  const resultTitle = resultPositive
    ? "Resultado estimado a ingresar"
    : "Resultado estimado a compensar / devolver";

  const how =
    model === "303"
      ? "IVA que cobraste en facturas − IVA de tus gastos deducibles."
      : "20 % de (ingresos − gastos) − retenciones que ya te hicieron en facturas.";

  return (
    <section className="card-panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="form-section-title">{title}</h2>
        <p className="form-section-hint">
          Periodo {summary.label}. Cálculo automático con lo que hay en el
          panel ({how}) Úsalo para rellenar el modelo en la AEAT; no es el
          modelo oficial presentado.
        </p>
      </div>

      {missingExpenses ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          Aún no hay gastos en este trimestre. Sin ellos el IVA soportado y los
          gastos del 130 van a 0, y el importe a ingresar sale más alto de lo
          real.{" "}
          <Link href="/fiscal/expenses" className="font-medium underline">
            Registrar gastos
          </Link>
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Casilla</th>
              <th className="px-2 py-2 text-left font-medium">Concepto</th>
              <th className="px-2 py-2 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {draft.boxes.map((b) => (
              <tr key={`${b.code}-${b.label}`} className="border-b border-line/50">
                <td className="px-2 py-2 font-mono text-ink-muted">{b.code}</td>
                <td className="px-2 py-2">{b.label}</td>
                <td className="px-2 py-2 text-right font-mono">
                  {formatCurrency(b.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={`rounded-lg px-4 py-3 text-sm ${
          missingExpenses
            ? "bg-line/40 text-ink-muted"
            : resultPositive
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success"
        }`}
      >
        <p className="font-medium">
          {resultTitle}:{" "}
          <span className="font-mono font-semibold">
            {formatCurrency(Math.abs(draft.result))}
          </span>
          {missingExpenses ? " (incompleto)" : null}
        </p>
        <p className="mt-1 text-xs opacity-90">{how}</p>
      </div>
    </section>
  );
}
