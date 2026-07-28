export type LineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPct: number;
};

export type CalculatedLine = LineInput & {
  sortOrder: number;
  lineSubtotal: number;
  lineVat: number;
  lineTotal: number;
};

export type DocumentTotals = {
  lines: CalculatedLine[];
  subtotal: number;
  vatAmount: number;
  vatBreakdown: { rate: number; base: number; amount: number }[];
  irpfRate: number;
  irpfAmount: number;
  total: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateLine(
  line: LineInput,
  sortOrder = 0
): CalculatedLine {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discountPct) || 0;
  const vat = Number(line.vatRate) || 0;

  const gross = qty * price;
  const lineSubtotal = round2(gross * (1 - discount / 100));
  const lineVat = round2(lineSubtotal * (vat / 100));
  const lineTotal = round2(lineSubtotal + lineVat);

  return {
    description: line.description,
    quantity: qty,
    unitPrice: price,
    vatRate: vat,
    discountPct: discount,
    sortOrder,
    lineSubtotal,
    lineVat,
    lineTotal,
  };
}

export function calculateDocument(
  lines: LineInput[],
  irpfRate = 0
): DocumentTotals {
  const calculated = lines.map((l, i) => calculateLine(l, i));
  const subtotal = round2(calculated.reduce((s, l) => s + l.lineSubtotal, 0));
  const vatAmount = round2(calculated.reduce((s, l) => s + l.lineVat, 0));

  const byRate = new Map<number, { base: number; amount: number }>();
  for (const l of calculated) {
    const cur = byRate.get(l.vatRate) ?? { base: 0, amount: 0 };
    cur.base = round2(cur.base + l.lineSubtotal);
    cur.amount = round2(cur.amount + l.lineVat);
    byRate.set(l.vatRate, cur);
  }

  const vatBreakdown = [...byRate.entries()]
    .map(([rate, v]) => ({ rate, base: v.base, amount: v.amount }))
    .sort((a, b) => b.rate - a.rate);

  const rate = Number(irpfRate) || 0;
  const irpfAmount = round2(subtotal * (rate / 100));
  const total = round2(subtotal + vatAmount - irpfAmount);

  return {
    lines: calculated,
    subtotal,
    vatAmount,
    vatBreakdown,
    irpfRate: rate,
    irpfAmount,
    total,
  };
}

export function formatCurrency(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const VAT_RATES = [21, 10, 4, 0] as const;
export const IRPF_RATES = [0, 7, 15] as const;
