"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import type { LineInput } from "@/lib/calculations";
import {
  computeInitialNextRun,
  type Frequency,
} from "@/lib/recurring";

export type RecurringFormState = { error?: string };

function parseLines(formData: FormData): LineInput[] {
  const raw = String(formData.get("linesJson") ?? "[]");
  return (JSON.parse(raw) as LineInput[]).filter((l) => l.description?.trim());
}

function parseTemplateFields(formData: FormData) {
  const frequency = String(formData.get("frequency") ?? "MENSUAL") as Frequency;
  const intervalCount =
    parseInt(String(formData.get("intervalCount") ?? "1"), 10) || 1;
  const dayOfMonth = parseInt(String(formData.get("dayOfMonth") ?? "1"), 10);
  const startDate = new Date(String(formData.get("startDate")));
  const endRaw = String(formData.get("endDate") ?? "");
  const endDate = endRaw ? new Date(endRaw) : null;
  const vatOperationType = String(
    formData.get("vatOperationType") ?? "SUJETA"
  ).toUpperCase();

  return {
    name: String(formData.get("name") ?? "").trim(),
    clientId: String(formData.get("clientId") ?? ""),
    seriesId: String(formData.get("seriesId") ?? ""),
    frequency,
    intervalCount,
    dayOfMonth,
    startDate,
    endDate,
    notes: String(formData.get("notes") ?? "").trim() || null,
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim() || null,
    bankIban: String(formData.get("bankIban") ?? "").trim() || null,
    irpfRate: parseFloat(String(formData.get("irpfRate") ?? "0")) || 0,
    vatOperationType,
    cashAccounting: formData.get("cashAccounting") === "on",
    operationKey: String(formData.get("operationKey") ?? "").trim() || null,
    operationKey347:
      String(formData.get("operationKey347") ?? "").trim() || null,
    lines: parseLines(formData),
  };
}

export async function createRecurring(
  _prev: RecurringFormState,
  formData: FormData
): Promise<RecurringFormState> {
  await requireAuth();
  const data = parseTemplateFields(formData);

  if (!data.name) return { error: "El nombre es obligatorio" };
  if (!data.clientId) return { error: "Selecciona un cliente" };
  if (!data.seriesId) return { error: "Selecciona una serie" };
  if (!data.lines.length) return { error: "Añade al menos una línea" };

  const nextRunDate = computeInitialNextRun(
    data.startDate,
    data.dayOfMonth,
    data.frequency,
    data.intervalCount,
    new Date(),
    data.endDate
  );

  const template = await prisma.recurringInvoiceTemplate.create({
    data: {
      name: data.name,
      clientId: data.clientId,
      seriesId: data.seriesId,
      frequency: data.frequency,
      intervalCount: data.intervalCount,
      dayOfMonth: data.dayOfMonth,
      startDate: data.startDate,
      endDate: data.endDate,
      status: "ACTIVA",
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      bankIban: data.bankIban,
      irpfRate: data.irpfRate,
      vatOperationType: data.vatOperationType,
      cashAccounting: data.cashAccounting,
      operationKey: data.operationKey,
      operationKey347: data.operationKey347,
      nextRunDate,
      lines: {
        create: data.lines.map((l, i) => ({
          sortOrder: i,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate:
            data.vatOperationType === "EXENTA" ||
            data.vatOperationType === "INTRACOMUNITARIA" ||
            data.vatOperationType === "EXPORTACION"
              ? 0
              : l.vatRate,
          discountPct: l.discountPct,
        })),
      },
    },
  });

  revalidatePath("/recurring");
  redirect(`/recurring/${template.id}`);
}

export async function updateRecurring(
  id: string,
  _prev: RecurringFormState,
  formData: FormData
): Promise<RecurringFormState> {
  await requireAuth();
  const data = parseTemplateFields(formData);

  if (!data.name) return { error: "El nombre es obligatorio" };
  if (!data.lines.length) return { error: "Añade al menos una línea" };

  const nextRunDate = computeInitialNextRun(
    data.startDate,
    data.dayOfMonth,
    data.frequency,
    data.intervalCount,
    new Date(),
    data.endDate
  );

  await prisma.recurringLine.deleteMany({ where: { templateId: id } });
  await prisma.recurringInvoiceTemplate.update({
    where: { id },
    data: {
      name: data.name,
      clientId: data.clientId,
      seriesId: data.seriesId,
      frequency: data.frequency,
      intervalCount: data.intervalCount,
      dayOfMonth: data.dayOfMonth,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      bankIban: data.bankIban,
      irpfRate: data.irpfRate,
      vatOperationType: data.vatOperationType,
      cashAccounting: data.cashAccounting,
      operationKey: data.operationKey,
      operationKey347: data.operationKey347,
      nextRunDate,
      lines: {
        create: data.lines.map((l, i) => ({
          sortOrder: i,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          vatRate:
            data.vatOperationType === "EXENTA" ||
            data.vatOperationType === "INTRACOMUNITARIA" ||
            data.vatOperationType === "EXPORTACION"
              ? 0
              : l.vatRate,
          discountPct: l.discountPct,
        })),
      },
    },
  });

  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
  redirect(`/recurring/${id}`);
}

export async function setRecurringStatus(
  id: string,
  status: "ACTIVA" | "PAUSADA" | "FINALIZADA"
) {
  await requireAuth();
  await prisma.recurringInvoiceTemplate.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/recurring");
  revalidatePath(`/recurring/${id}`);
}
