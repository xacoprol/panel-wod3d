import Link from "next/link";
import {
  buildFiscalPeriodSummary,
  parseFiscalPeriod,
} from "@/lib/fiscal";
import { FiscalPeriodNav } from "@/components/fiscal/FiscalPeriodNav";
import { ModeloDraft } from "@/components/fiscal/ModeloDraft";

export default async function Modelo303Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { year, quarter } = parseFiscalPeriod(sp);
  const summary = await buildFiscalPeriodSummary(year, quarter);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/fiscal?year=${year}&q=${quarter}`} className="text-sm text-ink-muted hover:text-accent">
          ← Fiscal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Modelo 303
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Autoliquidación IVA trimestral (borrador)
        </p>
      </div>
      <FiscalPeriodNav
        year={year}
        quarter={quarter}
        basePath="/fiscal/303"
      />
      <ModeloDraft title="Casillas orientativas" model="303" summary={summary} />
      <p className="text-xs text-ink-muted">
        Usa estos importes como guía al rellenar el modelo en la sede
        electrónica. Las numeraciones de casilla corresponden al régimen
        general habitual y pueden variar según tu situación.
      </p>
    </div>
  );
}
