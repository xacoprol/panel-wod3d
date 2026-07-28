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
 * Calcula la próxima fecha de generación >= asOf (por defecto hoy),
 * avanzando de uno en uno desde startDate. Seguro para rangos largos
 * (p.ej. 2021–2040 anuales ≈ 20 iteraciones máx.).
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
  while (candidate < today && guard < 500) {
    candidate = advanceDate(candidate, frequency, dayOfMonth, intervalCount);
    guard++;
    if (endDate && candidate > startOfDay(endDate)) return null;
  }

  if (endDate && candidate > startOfDay(endDate)) return null;
  return candidate;
}

export const VAT_OPERATION_TYPES = [
  { value: "SUJETA", label: "Sujeta a IVA" },
  { value: "EXENTA", label: "Exenta de IVA" },
  { value: "INTRACOMUNITARIA", label: "Intracomunitaria" },
  { value: "EXPORTACION", label: "Exportación" },
] as const;
