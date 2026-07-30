import { addMonths, addYears, setDate, startOfDay } from "date-fns";

export type Frequency = "MENSUAL" | "TRIMESTRAL" | "SEMESTRAL" | "ANUAL";

/**
 * Avanza una fecha según frecuencia × intervalCount (repetirCada).
 * Ej. ANUAL + intervalCount=1 → +1 año; MENSUAL + 3 → +3 meses.
 * Solo calcula el siguiente ciclo — no genera series futuras.
 */
export function advanceDate(
  from: Date,
  frequency: Frequency,
  dayOfMonth: number,
  intervalCount = 1
): Date {
  const n = Math.max(1, intervalCount || 1);
  let next: Date;
  switch (frequency) {
    case "MENSUAL":
      next = addMonths(from, n);
      break;
    case "TRIMESTRAL":
      next = addMonths(from, 3 * n);
      break;
    case "SEMESTRAL":
      next = addMonths(from, 6 * n);
      break;
    case "ANUAL":
      next = addYears(from, n);
      break;
    default:
      next = addMonths(from, n);
  }
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  return startOfDay(setDate(next, day));
}

/**
 * Calcula la próxima fecha de generación estrictamente posterior a asOf
 * (por defecto hoy), avanzando desde startDate. Así, al crear una plantilla
 * no se programa una factura para el mismo día (el cron no la emite al momento).
 */
export function computeInitialNextRun(
  startDate: Date,
  dayOfMonth: number,
  frequency: Frequency,
  intervalCount = 1,
  asOf: Date = new Date(),
  endDate?: Date | null
): Date | null {
  const today = startOfDay(asOf);
  const lastDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    0
  ).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  let candidate = startOfDay(setDate(new Date(startDate), day));

  if (candidate < startOfDay(startDate)) {
    candidate = advanceDate(candidate, frequency, dayOfMonth, intervalCount);
  }

  // Cap iterations to avoid infinite loops on bad data
  let guard = 0;
  while (candidate <= today && guard < 500) {
    candidate = advanceDate(candidate, frequency, dayOfMonth, intervalCount);
    guard++;
    if (endDate && candidate > startOfDay(endDate)) return null;
  }

  if (endDate && candidate > startOfDay(endDate)) return null;
  return candidate;
}

export const VAT_OPERATION_TYPES = [
  { value: "SUJETA", label: "Sujeta a IVA (península / Baleares)" },
  { value: "EXENTA", label: "Exenta de IVA" },
  { value: "INTRACOMUNITARIA", label: "Intracomunitaria (UE)" },
  { value: "CANARIAS", label: "Canarias (sin IVA peninsular)" },
  { value: "EXPORTACION", label: "Exportación (fuera UE)" },
] as const;

export type VatOperationType = (typeof VAT_OPERATION_TYPES)[number]["value"];

/** Operaciones que no llevan cuota de IVA en factura peninsular. */
export function isZeroVatOperation(op: string): boolean {
  const v = op.toUpperCase();
  return (
    v === "EXENTA" ||
    v === "INTRACOMUNITARIA" ||
    v === "CANARIAS" ||
    v === "EXPORTACION"
  );
}

export function parseVatOperationType(raw: unknown): VatOperationType {
  const v = String(raw ?? "SUJETA").toUpperCase();
  const allowed = VAT_OPERATION_TYPES.map((t) => t.value) as string[];
  return (allowed.includes(v) ? v : "SUJETA") as VatOperationType;
}
