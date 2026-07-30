import { endOfYear, startOfYear } from "date-fns";
import { prisma } from "@/lib/prisma";

export type FiscalQuarter = 1 | 2 | 3 | 4;

export type VatBucket = {
  rate: number;
  base: number;
  quota: number;
};

export type ModeloBoxes = {
  boxes: { code: string; label: string; value: number }[];
  result: number;
};

export type FiscalPeriodSummary = {
  year: number;
  quarter: FiscalQuarter;
  from: Date;
  to: Date;
  label: string;
  issued: {
    count: number;
    vatBuckets: VatBucket[];
    baseSujeta: number;
    quotaRepercutida: number;
    baseExenta: number;
    baseIntracom: number;
    baseExport: number;
    baseCanarias: number;
    baseMarketplaceCollected: number;
    irpfWithheld: number;
    incomeBase: number;
    invoiceIncomeBase: number;
    marketplaceCount: number;
    marketplaceIncomeBase: number;
  };
  expenses: {
    count: number;
    base: number;
    vatDeductible: number;
    total: number;
  };
  modelo303: ModeloBoxes;
  modelo130: ModeloBoxes;
};

export type FiscalQuarterSlice = {
  quarter: FiscalQuarter;
  label: string;
  incomeBase: number;
  expensesBase: number;
  irpfWithheld: number;
  modelo303Result: number;
  modelo130Result: number;
};

export type FiscalYearSummary = {
  year: number;
  from: Date;
  to: Date;
  label: string;
  issued: FiscalPeriodSummary["issued"];
  expenses: FiscalPeriodSummary["expenses"];
  modelo303: ModeloBoxes;
  modelo130: ModeloBoxes;
  /** Borrador orientativo Modelo 390 (declaración-resumen anual IVA) */
  modelo390: ModeloBoxes;
  /** Suma de resultados 303 de cada trimestre (a ingresar neto del año) */
  ivaNetYear: number;
  /** Suma de resultados 130 de cada trimestre */
  irpfPaymentsYear: number;
  quarters: FiscalQuarterSlice[];
};

type InvoiceRow = {
  issueDate: Date;
  subtotal: unknown;
  vatAmount: unknown;
  irpfAmount: unknown;
  vatOperationType: string | null;
  lines: {
    vatRate: number;
    lineSubtotal: unknown;
    lineVat: unknown;
  }[];
};

type ExpenseRow = {
  issueDate: Date;
  subtotal: unknown;
  vatAmount: unknown;
  total: unknown;
};

type MarketplaceRow = {
  issueDate: Date;
  subtotal: unknown;
  vatAmount: unknown;
  vatRate: number;
  vatStatus: string | null;
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

export function yearRange(year: number): { from: Date; to: Date } {
  const from = startOfYear(new Date(year, 0, 1));
  const to = endOfYear(new Date(year, 0, 1));
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

export function parseFiscalYear(sp: { year?: string }): number {
  const nowY = new Date().getFullYear();
  const year = parseInt(sp.year ?? "", 10);
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : nowY;
}

export const EXPENSE_CATEGORIES = [
  { id: "SUMINISTROS", label: "Suministros" },
  { id: "SOFTWARE", label: "Software / SaaS" },
  { id: "MATERIAL", label: "Material" },
  { id: "DIETAS", label: "Dietas / desplazamiento" },
  { id: "PROFESIONALES", label: "Servicios profesionales" },
  { id: "OTROS", label: "Otros" },
] as const;

function addBucket(
  map: Map<number, VatBucket>,
  rate: number,
  base: number,
  quota: number
) {
  const cur = map.get(rate) ?? { rate, base: 0, quota: 0 };
  cur.base = round2(cur.base + base);
  cur.quota = round2(cur.quota + quota);
  map.set(rate, cur);
}

function inRange(d: Date, from: Date, to: Date): boolean {
  return d >= from && d <= to;
}

function buildModelo303(
  vatBuckets: VatBucket[],
  expenseVat: number
): ModeloBoxes {
  const bucketAt = (rate: number) =>
    vatBuckets.find((b) => Math.abs(b.rate - rate) < 0.01) ?? {
      rate,
      base: 0,
      quota: 0,
    };
  const b4 = bucketAt(4);
  const b10 = bucketAt(10);
  const b21 = bucketAt(21);
  const quotaRepercutida = round2(
    vatBuckets.reduce((s, b) => s + b.quota, 0)
  );
  const otherQuota = round2(
    vatBuckets
      .filter((b) => ![4, 10, 21].some((r) => Math.abs(b.rate - r) < 0.01))
      .reduce((s, b) => s + b.quota, 0)
  );
  const ivaResult = round2(quotaRepercutida - expenseVat);

  return {
    boxes: [
      { code: "01", label: "Base imponible 4%", value: b4.base },
      { code: "03", label: "Cuota 4%", value: b4.quota },
      { code: "04", label: "Base imponible 10%", value: b10.base },
      { code: "06", label: "Cuota 10%", value: b10.quota },
      { code: "07", label: "Base imponible 21%", value: b21.base },
      { code: "09", label: "Cuota 21%", value: b21.quota },
      { code: "—", label: "Otras cuotas repercutidas", value: otherQuota },
      { code: "28", label: "Total cuota repercutida", value: quotaRepercutida },
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
}

/**
 * Borrador orientativo Modelo 390 (resumen anual IVA).
 * Números de casilla aproximados al régimen general habitual; verificar en AEAT.
 * Declaración informativa: no genera pago (result = suma de 303 del año).
 */
function buildModelo390(
  issued: FiscalPeriodSummary["issued"],
  expenses: FiscalPeriodSummary["expenses"],
  ivaNetYear: number
): ModeloBoxes {
  const bucketAt = (rate: number) =>
    issued.vatBuckets.find((b) => Math.abs(b.rate - rate) < 0.01) ?? {
      rate,
      base: 0,
      quota: 0,
    };
  const b4 = bucketAt(4);
  const b10 = bucketAt(10);
  const b21 = bucketAt(21);
  const otherBase = round2(
    issued.vatBuckets
      .filter((b) => ![4, 10, 21].some((r) => Math.abs(b.rate - r) < 0.01))
      .reduce((s, b) => s + b.base, 0)
  );
  const otherQuota = round2(
    issued.vatBuckets
      .filter((b) => ![4, 10, 21].some((r) => Math.abs(b.rate - r) < 0.01))
      .reduce((s, b) => s + b.quota, 0)
  );

  const volumeOps = round2(
    issued.baseSujeta +
      issued.baseExenta +
      issued.baseIntracom +
      issued.baseExport +
      issued.baseCanarias +
      issued.baseMarketplaceCollected
  );

  return {
    boxes: [
      {
        code: "99",
        label: "Volumen de operaciones (orientativo)",
        value: volumeOps,
      },
      { code: "01", label: "Base imponible 4% (régimen general)", value: b4.base },
      { code: "02", label: "Cuota 4%", value: b4.quota },
      { code: "03", label: "Base imponible 10%", value: b10.base },
      { code: "04", label: "Cuota 10%", value: b10.quota },
      { code: "05", label: "Base imponible 21%", value: b21.base },
      { code: "06", label: "Cuota 21%", value: b21.quota },
      {
        code: "—",
        label: "Otras bases sujetas (tipos distintos)",
        value: otherBase,
      },
      {
        code: "—",
        label: "Otras cuotas repercutidas",
        value: otherQuota,
      },
      {
        code: "21",
        label: "Total bases régimen general (sujetas)",
        value: issued.baseSujeta,
      },
      {
        code: "22",
        label: "Total cuotas IVA devengado",
        value: issued.quotaRepercutida,
      },
      {
        code: "—",
        label: "Operaciones exentas",
        value: issued.baseExenta,
      },
      {
        code: "—",
        label: "Intracomunitarias (base)",
        value: issued.baseIntracom,
      },
      {
        code: "—",
        label: "Exportaciones (base)",
        value: issued.baseExport,
      },
      {
        code: "—",
        label: "Canarias / IGIC (base)",
        value: issued.baseCanarias,
      },
      {
        code: "—",
        label: "Marketplace OSS (IVA recaudado por plataforma)",
        value: issued.baseMarketplaceCollected,
      },
      {
        code: "29",
        label: "IVA deducible (gastos corrientes)",
        value: expenses.vatDeductible,
      },
      {
        code: "48",
        label: "Base gastos deducibles (referencia)",
        value: expenses.base,
      },
      {
        code: "86",
        label: "Resultado liquidación anual (suma 303)",
        value: ivaNetYear,
      },
    ],
    result: ivaNetYear,
  };
}

function buildModelo130(
  incomeBase: number,
  expenseBase: number,
  irpfWithheld: number
): ModeloBoxes {
  const rendimiento = round2(incomeBase - expenseBase);
  const pago20 = round2(Math.max(0, rendimiento) * 0.2);
  const resultado130 = round2(pago20 - irpfWithheld);

  return {
    boxes: [
      {
        code: "01",
        label: "Ingresos computables (facturas + marketplace)",
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
}

function aggregateRows(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  marketplace: MarketplaceRow[],
  from: Date,
  to: Date
): {
  issued: FiscalPeriodSummary["issued"];
  expenses: FiscalPeriodSummary["expenses"];
  modelo303: ModeloBoxes;
  modelo130: ModeloBoxes;
} {
  const invs = invoices.filter((i) => inRange(i.issueDate, from, to));
  const exps = expenses.filter((e) => inRange(e.issueDate, from, to));
  const mkts = marketplace.filter((m) => inRange(m.issueDate, from, to));

  const vatMap = new Map<number, VatBucket>();
  let baseExenta = 0;
  let baseIntracom = 0;
  let baseExport = 0;
  let baseCanarias = 0;
  let baseMarketplaceCollected = 0;
  let irpfWithheld = 0;
  let invoiceIncomeBase = 0;

  for (const inv of invs) {
    const subtotal = Number(inv.subtotal);
    invoiceIncomeBase = round2(invoiceIncomeBase + subtotal);
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
      const rate =
        subtotal > 0
          ? round2((Number(inv.vatAmount) / subtotal) * 100)
          : 21;
      addBucket(vatMap, rate, subtotal, Number(inv.vatAmount));
    }
  }

  let marketplaceIncomeBase = 0;
  for (const m of mkts) {
    const subtotal = Number(m.subtotal);
    const vatAmount = Number(m.vatAmount);
    marketplaceIncomeBase = round2(marketplaceIncomeBase + subtotal);
    const status = (m.vatStatus || "TAXABLE").toUpperCase();
    if (status === "TAXABLE") {
      addBucket(vatMap, m.vatRate || 21, subtotal, vatAmount);
    } else if (status === "MARKETPLACE_COLLECTED") {
      baseMarketplaceCollected = round2(baseMarketplaceCollected + subtotal);
    } else {
      baseExenta = round2(baseExenta + subtotal);
    }
  }

  const incomeBase = round2(invoiceIncomeBase + marketplaceIncomeBase);
  const vatBuckets = [...vatMap.values()].sort((a, b) => b.rate - a.rate);
  const baseSujeta = round2(vatBuckets.reduce((s, b) => s + b.base, 0));
  const quotaRepercutida = round2(
    vatBuckets.reduce((s, b) => s + b.quota, 0)
  );

  let expenseBase = 0;
  let expenseVat = 0;
  let expenseTotal = 0;
  for (const e of exps) {
    expenseBase = round2(expenseBase + Number(e.subtotal));
    expenseVat = round2(expenseVat + Number(e.vatAmount));
    expenseTotal = round2(expenseTotal + Number(e.total));
  }

  return {
    issued: {
      count: invs.length,
      vatBuckets,
      baseSujeta,
      quotaRepercutida,
      baseExenta,
      baseIntracom,
      baseExport,
      baseCanarias,
      baseMarketplaceCollected,
      irpfWithheld,
      incomeBase,
      invoiceIncomeBase,
      marketplaceCount: mkts.length,
      marketplaceIncomeBase,
    },
    expenses: {
      count: exps.length,
      base: expenseBase,
      vatDeductible: expenseVat,
      total: expenseTotal,
    },
    modelo303: buildModelo303(vatBuckets, expenseVat),
    modelo130: buildModelo130(incomeBase, expenseBase, irpfWithheld),
  };
}

const invoiceSelect = {
  issueDate: true,
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
} as const;

async function fetchFiscalRows(from: Date, to: Date) {
  const [invoices, expenses, marketplace] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: { not: "ANULADA" },
        issueDate: { gte: from, lte: to },
      },
      select: invoiceSelect,
    }),
    prisma.expense.findMany({
      where: {
        issueDate: { gte: from, lte: to },
        deductible: true,
      },
      select: {
        issueDate: true,
        subtotal: true,
        vatAmount: true,
        total: true,
      },
    }),
    prisma.marketplaceIncome.findMany({
      where: {
        issueDate: { gte: from, lte: to },
      },
      select: {
        issueDate: true,
        subtotal: true,
        vatAmount: true,
        vatRate: true,
        vatStatus: true,
      },
    }),
  ]);
  return {
    invoices: invoices as InvoiceRow[],
    expenses: expenses as ExpenseRow[],
    marketplace: marketplace as MarketplaceRow[],
  };
}

/** Agrega facturas emitidas + gastos del trimestre para libros y borradores 303/130. */
export async function buildFiscalPeriodSummary(
  year: number,
  quarter: FiscalQuarter
): Promise<FiscalPeriodSummary> {
  const { from, to } = quarterRange(year, quarter);
  const label = `${quarter}T ${year}`;
  const { invoices, expenses, marketplace } = await fetchFiscalRows(from, to);
  const agg = aggregateRows(invoices, expenses, marketplace, from, to);

  return {
    year,
    quarter,
    from,
    to,
    label,
    ...agg,
  };
}

/**
 * Resumen fiscal del año completo: 3 queries + agregación en memoria
 * (anual + desglose por trimestre).
 */
export async function buildFiscalYearSummary(
  year: number
): Promise<FiscalYearSummary> {
  const { from, to } = yearRange(year);
  const { invoices, expenses, marketplace } = await fetchFiscalRows(from, to);
  const yearAgg = aggregateRows(invoices, expenses, marketplace, from, to);

  const quarters: FiscalQuarterSlice[] = ([1, 2, 3, 4] as FiscalQuarter[]).map(
    (q) => {
      const range = quarterRange(year, q);
      const agg = aggregateRows(
        invoices,
        expenses,
        marketplace,
        range.from,
        range.to
      );
      return {
        quarter: q,
        label: `${q}T ${year}`,
        incomeBase: agg.issued.incomeBase,
        expensesBase: agg.expenses.base,
        irpfWithheld: agg.issued.irpfWithheld,
        modelo303Result: agg.modelo303.result,
        modelo130Result: agg.modelo130.result,
      };
    }
  );

  const ivaNetYear = round2(
    quarters.reduce((s, q) => s + q.modelo303Result, 0)
  );
  const irpfPaymentsYear = round2(
    quarters.reduce((s, q) => s + q.modelo130Result, 0)
  );

  return {
    year,
    from,
    to,
    label: `Año ${year}`,
    issued: yearAgg.issued,
    expenses: yearAgg.expenses,
    modelo303: yearAgg.modelo303,
    modelo130: yearAgg.modelo130,
    modelo390: buildModelo390(yearAgg.issued, yearAgg.expenses, ivaNetYear),
    ivaNetYear,
    irpfPaymentsYear,
    quarters,
  };
}
