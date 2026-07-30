import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  buildFiscalPeriodSummary,
  parseFiscalPeriod,
} from "@/lib/fiscal";
import { FiscalPeriodNav } from "@/components/fiscal/FiscalPeriodNav";
import { ModeloDraft } from "@/components/fiscal/ModeloDraft";

export default async function Modelo130Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { year, quarter } = parseFiscalPeriod(sp);
  const summary = await buildFiscalPeriodSummary(year, quarter);
  const settings = await prisma.companySettings.findFirst();
  const regime = settings?.fiscalRegime ?? "130";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={`/fiscal?year=${year}&q=${quarter}`} className="text-sm text-ink-muted hover:text-accent">
          ← Fiscal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Modelo 130
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pago fraccionado IRPF · estimación directa (borrador)
        </p>
      </div>
      <FiscalPeriodNav
        year={year}
        quarter={quarter}
        basePath="/fiscal/130"
      />
      {regime === "131" ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          En Ajustes figura régimen 131 (módulos). Este borrador 130 no te
          aplica.
        </p>
      ) : null}
      <ModeloDraft title="Casillas orientativas" model="130" summary={summary} />
      <p className="text-xs text-ink-muted">
        Ingresos = bases de facturas emitidas (sin IVA). Gastos = bases de
        gastos marcados como deducibles. El 20 % es el porcentaje general del
        pago a cuenta; las retenciones de tus facturas se restan.
      </p>
    </div>
  );
}
