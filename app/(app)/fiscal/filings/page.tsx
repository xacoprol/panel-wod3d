import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { FilingDropZone } from "@/components/fiscal/FilingDropZone";
import { deleteFiscalFiling } from "./actions";

function periodLabel(modelType: string, year: number, quarter: number | null) {
  if (modelType === "390" || quarter == null) return `Año ${year}`;
  return `${quarter}T ${year}`;
}

export default async function FiscalFilingsPage() {
  const filings = await prisma.fiscalFiling.findMany({
    orderBy: [{ year: "desc" }, { modelType: "asc" }, { quarter: "asc" }],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/fiscal" className="text-sm text-ink-muted hover:text-accent">
            ← Fiscal
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Modelos presentados
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sube lo que la gestoría ya presentó (303, 130, 390) para contrastarlo
            con los borradores del panel
          </p>
        </div>
      </div>

      <p className="rounded-lg border border-line bg-accent-soft/40 px-4 py-3 text-sm text-ink-muted">
        Gemini lee el PDF o la imagen. Revisas las casillas y se guarda como
        oficial. No sustituye el cálculo del panel: sirve para ver diferencias y
        llevar el control de cara al 390 de enero.
      </p>

      <FilingDropZone />

      <section className="card-panel overflow-x-auto">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Registrados</h2>
        </div>
        {filings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Aún no hay modelos presentados. Sube el 390 de 2025 y los 303/130 de
            2026.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Modelo</th>
                <th className="px-4 py-2 text-left font-medium">Periodo</th>
                <th className="px-4 py-2 text-right font-medium">Resultado</th>
                <th className="px-4 py-2 text-left font-medium">Presentado</th>
                <th className="px-4 py-2 text-left font-medium">Archivo</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {filings.map((f) => {
                const href =
                  f.modelType === "390"
                    ? `/fiscal/390?year=${f.year}`
                    : `/fiscal/${f.modelType}?year=${f.year}&q=${f.quarter ?? 1}`;
                return (
                  <tr key={f.id} className="border-b border-line/50">
                    <td className="px-4 py-2 font-mono">
                      <Link href={href} className="hover:text-accent">
                        {f.modelType}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {periodLabel(f.modelType, f.year, f.quarter)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(Number(f.result))}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">
                      {f.filedAt ? formatDate(f.filedAt) : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-muted">
                      {f.sourceFileName ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteFiscalFiling.bind(null, f.id)}>
                        <button
                          type="submit"
                          className="text-xs text-danger hover:underline"
                        >
                          Borrar
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
