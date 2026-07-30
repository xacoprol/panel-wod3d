import { prisma } from "@/lib/prisma";

export type FiscalQuarter = 1 | 2 | 3 | 4;

export type VatBucket = {
  rate: number;
  base: number;
  quota: number;
};

export type FiscalPeriodSummary = {
  year: number;
  quarter: FiscalQuarter;
  from: Date;
  to: Date;
  label: string;
  issued: {
    count: number;
    /** Bases sujetas a IVA (por tipo) */
    vatBuckets: VatBucket[];
    baseSujeta: number;
    quotaRepercutida: number;
    baseExenta: number;
    baseIntracom: number;
    baseExport: number;
    baseCanarias: number;
    /** IRPF retenido por clientes en facturas emitidas */
    irpfWithheld: number;
    /** Ingresos computables ≈ bases (sin IVA) de facturas no anuladas */
    incomeBase: number;
  };
  expenses: {
    count: number;
    base: number;
    vatDeductible: number;
    total: number;
  };
  modelo303: {
    boxes: { code: string; label: string; value: number }[];
    result: number;
  };
  modelo130: {
    boxes: { code: string; label: string; value: number }[];
    result: number;
  };
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function quarterRange(
  year: number,
  quarter: FiscalQuarter
): { from: Date; to: Date } {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const to = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { from, to };
}

export function currentFiscalPeriod(now = new Date()): {
  year: number;
  quarter: FiscalQuarter;
} {
  const month = now.getMonth();
  const quarter = (Math.floor(month / 3) + 1) as FiscalQuarter;
  return { year: now.getFullYear(), quarter };
}

export function parseFiscalPeriod(sp: {
  year?: string;
  q?: string;
}): { year: number; quarter: FiscalQuarter } {
  const now = currentFiscalPeriod();
  const year = parseInt(sp.year ?? "", 10);
  const q = parseInt(sp.q ?? "", 10);
  return {
    year: Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : now.year,
    quarter:
      q === 1 || q === 2 || q === 3 || q === 4 ? (q as FiscalQuarter) : now.quarter,
  };
}

export const EXPENSE_CATEGORIES = [
  { id: "SUMINISTROS", label: "Suministros" },
  { id: "SOFTWARE", label: "Software / SaaS" },
  { id: "MATERIAL", label: "Material" },
  { id: "DIETAS", label: "Dietas / desplazamiento" },
  { id: "PROFESIONALES", label: "Servicios profesionales" },
  { id: "OTROS", label: "Otros" },
] as const;

function addBucket(map: Map<number, VatBucket>, rate: number, base: number, quota: number) {
  const cur = map.get(rate) ?? { rate, base: 0, quota: 0 };
  cur.base = round2(cur.base + base);
  cur.quota = round2(cur.quota + quota);
  map.set(rate, cur);
}

/** Agrega facturas emitidas + gastos del trimestre para libros y borradores 303/130. */
export async function buildFiscalPeriodSummary(
  year: number,
  quarter: FiscalQuarter
): Promise<FiscalPeriodSummary> {
  const { from, to } = quarterRange(year, quarter);
  const label = `${quarter}T ${year}`;

  const [invoices, expenses] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { not: "ANULADA" },
        issueDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        subtotal: true,
        vatAmount: true,
        irpfAmount: true,
        vatOperationType: true,
        lines: {
          select: {
            vatRate: true,
            lineSubtotal: true,
            lineVat: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: {
        issueDate: { gte: from, lte: to },
        deductible: true,
      },
      select: {
        subtotal: true,
        vatAmount: true,
        total: true,
      },
    }),
  ]);

  const vatMap = new Map<number, VatBucket>();
  let baseExenta = 0;
  let baseIntracom = 0;
  let baseExport = 0;
  let baseCanarias = 0;
  let irpfWithheld = 0;
  let incomeBase = 0;

  for (const inv of invoices) {
    const subtotal = Number(inv.subtotal);
    incomeBase = round2(incomeBase + subtotal);
    irpfWithheld = round2(irpfWithheld + Number(inv.irpfAmount));

    const op = (inv.vatOperationType || "SUJETA").toUpperCase();
    if (op === "EXENTA") {
      baseExenta = round2(baseExenta + subtotal);
      continue;
    }
    if (op === "INTRACOMUNITARIA") {
      baseIntracom = round2(baseIntracom + subtotal);
      continue;
    }
    if (op === "CANARIAS") {
      baseCanarias = round2(baseCanarias + subtotal);
      continue;
    }
    if (op === "EXPORTACION") {
      baseExport = round2(baseExport + subtotal);
      continue;
    }

    // SUJETA: desglose por tipo de IVA en líneas
    if (inv.lines.length) {
      for (const line of inv.lines) {
        addBucket(
          vatMap,
          line.vatRate,
          Number(line.lineSubtotal),
          Number(line.lineVat)
        );
      }
    } else {
      // Fallback si no hay líneas
      const rate =
        subtotal > 0
          ? round2((Number(inv.vatAmount) / subtotal) * 100)
          : 21;
      addBucket(vatMap, rate, subtotal, Number(inv.vatAmount));
    }
  }

  const vatBuckets = [...vatMap.values()].sort((a, b) => b.rate - a.rate);
  const baseSujeta = round2(vatBuckets.reduce((s, b) => s + b.base, 0));
  const quotaRepercutida = round2(
    vatBuckets.reduce((s, b) => s + b.quota, 0)
  );

  let expenseBase = 0;
  let expenseVat = 0;
  let expenseTotal = 0;
  for (const e of expenses) {
    expenseBase = round2(expenseBase + Number(e.subtotal));
    expenseVat = round2(expenseVat + Number(e.vatAmount));
    expenseTotal = round2(expenseTotal + Number(e.total));
  }

  const bucketAt = (rate: number) =>
    vatBuckets.find((b) => Math.abs(b.rate - rate) < 0.01) ?? {
      rate,
      base: 0,
      quota: 0,
    };
  const b4 = bucketAt(4);
  const b10 = bucketAt(10);
  const b21 = bucketAt(21);
  const otherQuota = round2(
    vatBuckets
      .filter((b) => ![4, 10, 21].some((r) => Math.abs(b.rate - r) < 0.01))
      .reduce((s, b) => s + b.quota, 0)
  );

  const ivaResult = round2(quotaRepercutida - expenseVat);

  const modelo303 = {
    boxes: [
      { code: "01", label: "Base imponible 4%", value: b4.base },
      { code: "03", label: "Cuota 4%", value: b4.quota },
      { code: "04", label: "Base imponible 10%", value: b10.base },
      { code: "06", label: "Cuota 10%", value: b10.quota },
      { code: "07", label: "Base imponible 21%", value: b21.base },
      { code: "09", label: "Cuota 21%", value: b21.quota },
      {
        code: "—",
        label: "Otras cuotas repercutidas",
        value: otherQuota,
      },
      {
        code: "28",
        label: "Total cuota repercutida",
        value: quotaRepercutida,
      },
      {
        code: "29",
        label: "IVA soportado deducible (gastos)",
        value: expenseVat,
      },
      {
        code: "45",
        label: "Resultado (a ingresar / a compensar)",
        value: ivaResult,
      },
    ],
    result: ivaResult,
  };

  const rendimiento = round2(incomeBase - expenseBase);
  const pago20 = round2(Math.max(0, rendimiento) * 0.2);
  const resultado130 = round2(pago20 - irpfWithheld);

  const modelo130 = {
    boxes: [
      {
        code: "01",
        label: "Ingresos computables (bases facturas)",
        value: incomeBase,
      },
      {
        code: "02",
        label: "Gastos deducibles (bases)",
        value: expenseBase,
      },
      {
        code: "03",
        label: "Rendimiento neto (01 − 02)",
        value: rendimiento,
      },
      {
        code: "04",
        label: "20 % del rendimiento neto",
        value: pago20,
      },
      {
        code: "05",
        label: "Retenciones soportadas (IRPF en facturas)",
        value: irpfWithheld,
      },
      {
        code: "07",
        label: "Resultado (04 − 05)",
        value: resultado130,
      },
    ],
    result: resultado130,
  };

  return {
    year,
    quarter,
    from,
    to,
    label,
    issued: {
      count: invoices.length,
      vatBuckets,
      baseSujeta,
      quotaRepercutida,
      baseExenta,
      baseIntracom,
      baseExport,
      baseCanarias,
      irpfWithheld,
      incomeBase,
    },
    expenses: {
      count: expenses.length,
      base: expenseBase,
      vatDeductible: expenseVat,
      total: expenseTotal,
    },
    modelo303,
    modelo130,
  };
}
