"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import {
  fiscalFilingPeriodKey,
  type FiscalModelType,
  type FilingBox,
} from "@/lib/gemini-fiscal-filing";

export type FilingDraftInput = {
  modelType: FiscalModelType;
  year: number;
  quarter: number | null;
  filedAt: string | null;
  result: number;
  incomeBase: number | null;
  expensesBase: number | null;
  vatRepercutida: number | null;
  vatDeductible: number | null;
  boxes: FilingBox[];
  notes: string | null;
  confidence: string;
  sourceFileName: string | null;
  rawExtract?: Record<string, unknown> | null;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function validate(input: FilingDraftInput): string | null {
  if (!["303", "130", "390"].includes(input.modelType)) {
    return "Tipo de modelo no válido";
  }
  if (!Number.isFinite(input.year) || input.year < 2000 || input.year > 2100) {
    return "Año no válido";
  }
  if (input.modelType === "390") {
    if (input.quarter != null) return "El 390 no lleva trimestre";
  } else {
    if (input.quarter !== 1 && input.quarter !== 2 && input.quarter !== 3 && input.quarter !== 4) {
      return "Trimestre no válido (1–4)";
    }
  }
  return null;
}

export async function upsertFiscalFiling(
  input: FilingDraftInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAuth();
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const quarter = input.modelType === "390" ? null : input.quarter;
  const periodKey = fiscalFilingPeriodKey(input.modelType, input.year, quarter);
  const filedAt = input.filedAt ? new Date(`${input.filedAt}T12:00:00`) : null;
  const boxes = input.boxes.map((b) => ({
    code: b.code,
    label: b.label,
    value: round2(b.value),
  }));

  const boxesJson = boxes as Prisma.InputJsonValue;
  const rawJson =
    input.rawExtract != null
      ? (input.rawExtract as Prisma.InputJsonValue)
      : undefined;

  const toDec = (n: number | null) =>
    n == null ? null : new Prisma.Decimal(round2(n));

  try {
    const row = await prisma.fiscalFiling.upsert({
      where: { periodKey },
      create: {
        periodKey,
        modelType: input.modelType,
        year: input.year,
        quarter,
        filedAt,
        result: new Prisma.Decimal(round2(input.result)),
        incomeBase: toDec(input.incomeBase),
        expensesBase: toDec(input.expensesBase),
        vatRepercutida: toDec(input.vatRepercutida),
        vatDeductible: toDec(input.vatDeductible),
        boxes: boxesJson,
        rawExtract: rawJson,
        sourceFileName: input.sourceFileName,
        notes: input.notes,
        confidence: input.confidence || "medium",
      },
      update: {
        modelType: input.modelType,
        year: input.year,
        quarter,
        filedAt,
        result: new Prisma.Decimal(round2(input.result)),
        incomeBase: toDec(input.incomeBase),
        expensesBase: toDec(input.expensesBase),
        vatRepercutida: toDec(input.vatRepercutida),
        vatDeductible: toDec(input.vatDeductible),
        boxes: boxesJson,
        rawExtract: rawJson,
        sourceFileName: input.sourceFileName,
        notes: input.notes,
        confidence: input.confidence || "medium",
      },
    });

    revalidatePath("/fiscal");
    revalidatePath("/fiscal/filings");
    revalidatePath("/fiscal/303");
    revalidatePath("/fiscal/130");
    revalidatePath("/fiscal/390");
    revalidatePath("/fiscal/annual");
    revalidatePath("/stats");

    return { ok: true, id: row.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar",
    };
  }
}

export async function deleteFiscalFiling(id: string) {
  await requireAuth();
  await prisma.fiscalFiling.delete({ where: { id } });
  revalidatePath("/fiscal");
  revalidatePath("/fiscal/filings");
  revalidatePath("/fiscal/303");
  revalidatePath("/fiscal/130");
  revalidatePath("/fiscal/390");
  revalidatePath("/fiscal/annual");
}
