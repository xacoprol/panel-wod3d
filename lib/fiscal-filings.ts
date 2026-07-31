import { prisma } from "@/lib/prisma";
import {
  fiscalFilingPeriodKey,
  type FiscalModelType,
  type FilingBox,
} from "@/lib/gemini-fiscal-filing";

export type PresentedFilingView = {
  result: number;
  boxes: FilingBox[];
  sourceFileName: string | null;
  notes: string | null;
  year: number;
  quarter: number | null;
  modelType: string;
};

function parseBoxes(raw: unknown): FilingBox[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => {
    const o = b as Record<string, unknown>;
    return {
      code: String(o.code ?? "—"),
      label: String(o.label ?? ""),
      value: Number(o.value) || 0,
    };
  });
}

export async function getPresentedFiling(
  modelType: FiscalModelType,
  year: number,
  quarter: number | null
): Promise<PresentedFilingView | null> {
  const periodKey = fiscalFilingPeriodKey(modelType, year, quarter);
  const row = await prisma.fiscalFiling.findUnique({ where: { periodKey } });
  if (!row) return null;
  return {
    result: Number(row.result),
    boxes: parseBoxes(row.boxes),
    sourceFileName: row.sourceFileName,
    notes: row.notes,
    year: row.year,
    quarter: row.quarter,
    modelType: row.modelType,
  };
}

export async function listPresentedForYear(year: number) {
  return prisma.fiscalFiling.findMany({
    where: { year },
    orderBy: [{ modelType: "asc" }, { quarter: "asc" }],
  });
}
