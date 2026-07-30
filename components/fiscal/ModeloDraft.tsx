import { formatCurrency } from "@/lib/calculations";
import type { FiscalPeriodSummary } from "@/lib/fiscal";

type Props = {
  title: string;
  model: "303" | "130";
  summary: FiscalPeriodSummary;
};

export function ModeloDraft({ title, model, summary }: Props) {
  const draft = model === "303" ? summary.modelo303 : summary.modelo130;
  const resultLabel =
    draft.result >= 0 ? "A ingresar (orientativo)" : "A compensar / devolver (orientativo)";

  return (
    <section className="card-panel space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="form-section-title">{title}</h2>
        <p className="form-section-hint">
          Periodo {summary.label}. Borrador orientativo a partir de facturas y
          gastos del panel — revisa antes de presentar en la sede AEAT.
        </p>
      </div>

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
          draft.result >= 0
            ? "bg-warning/10 text-warning"
            : "bg-success/10 text-success"
        }`}
      >
        <span className="font-medium">{resultLabel}: </span>
        <span className="font-mono font-semibold">
          {formatCurrency(Math.abs(draft.result))}
        </span>
      </div>
    </section>
  );
}
