"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export type ExpenseFormState = {
  error?: string;
  duplicateId?: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeInvoiceNumber(raw: string | null | undefined): string | null {
  const v = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  return v || null;
}

function normalizeNif(raw: string | null | undefined): string | null {
  const v = String(raw ?? "")
    .trim()
    .replace(/[\s.-]/g, "")
    .toUpperCase();
  return v || null;
}

function parseExpenseForm(formData: FormData) {
  const subtotal =
    parseFloat(String(formData.get("subtotal") ?? "0").replace(",", ".")) || 0;
  const vatRate =
    parseFloat(String(formData.get("vatRate") ?? "21").replace(",", ".")) || 0;
  const vatAmountRaw = String(formData.get("vatAmount") ?? "").trim();
  const vatAmount = vatAmountRaw
    ? parseFloat(vatAmountRaw.replace(",", ".")) || 0
    : round2(subtotal * (vatRate / 100));
  const totalRaw = String(formData.get("total") ?? "").trim();
  const total = totalRaw
    ? parseFloat(totalRaw.replace(",", ".")) || 0
    : round2(subtotal + vatAmount);

  const issueDateRaw = String(formData.get("issueDate") ?? "").trim();
  return {
    issueDate: issueDateRaw ? new Date(issueDateRaw) : new Date(),
    supplierName: String(formData.get("supplierName") ?? "").trim(),
    supplierNif: String(formData.get("supplierNif") ?? "").trim() || null,
    invoiceNumber: normalizeInvoiceNumber(
      String(formData.get("invoiceNumber") ?? "")
    ),
    description: String(formData.get("description") ?? "").trim() || null,
    category: String(formData.get("category") ?? "OTROS").trim() || "OTROS",
    subtotal,
    vatRate,
    vatAmount,
    total,
    deductible:
      formData.get("deductible") === "on" ||
      formData.get("deductible") === "1",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

function validate(data: ReturnType<typeof parseExpenseForm>) {
  if (!data.supplierName) return "El proveedor es obligatorio";
  if (!(data.issueDate instanceof Date) || Number.isNaN(data.issueDate.getTime())) {
    return "Fecha no válida";
  }
  if (data.subtotal < 0) return "La base no puede ser negativa";
  if (data.vatAmount < 0) return "El IVA no puede ser negativo";
  return null;
}

/** Misma factura del mismo proveedor (por NIF o nombre). */
async function findDuplicateExpense(
  data: ReturnType<typeof parseExpenseForm>,
  excludeId?: string
) {
  if (!data.invoiceNumber) return null;

  const candidates = await prisma.expense.findMany({
    where: {
      invoiceNumber: { equals: data.invoiceNumber, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      supplierName: true,
      supplierNif: true,
      invoiceNumber: true,
      issueDate: true,
    },
    take: 20,
  });

  const nif = normalizeNif(data.supplierNif);
  const name = data.supplierName.trim().toLowerCase();

  return (
    candidates.find((c) => {
      const cNif = normalizeNif(c.supplierNif);
      if (nif && cNif && nif === cNif) return true;
      return c.supplierName.trim().toLowerCase() === name;
    }) ?? null
  );
}

function duplicateMessage(invoiceNumber: string | null) {
  return `Ya existe un gasto con la factura ${invoiceNumber ?? "indicada"} del mismo proveedor.`;
}

export async function createExpense(
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  await requireAuth();
  try {
    const data = parseExpenseForm(formData);
    const err = validate(data);
    if (err) return { error: err };

    const dup = await findDuplicateExpense(data);
    if (dup) {
      return {
        error: duplicateMessage(dup.invoiceNumber),
        duplicateId: dup.id,
      };
    }

    await prisma.expense.create({
      data: {
        ...data,
        deductible: formData.has("deductible"),
      },
    });
    revalidatePath("/fiscal");
    revalidatePath("/fiscal/expenses");
    redirect("/fiscal/expenses");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : "Error al crear" };
  }
}

export async function updateExpense(
  id: string,
  _prev: ExpenseFormState,
  formData: FormData
): Promise<ExpenseFormState> {
  await requireAuth();
  try {
    const data = parseExpenseForm(formData);
    const err = validate(data);
    if (err) return { error: err };

    const dup = await findDuplicateExpense(data, id);
    if (dup) {
      return {
        error: duplicateMessage(dup.invoiceNumber),
        duplicateId: dup.id,
      };
    }

    await prisma.expense.update({
      where: { id },
      data: {
        ...data,
        deductible: formData.has("deductible"),
      },
    });
    revalidatePath("/fiscal");
    revalidatePath("/fiscal/expenses");
    revalidatePath(`/fiscal/expenses/${id}/edit`);
    redirect("/fiscal/expenses");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function deleteExpense(id: string) {
  await requireAuth();
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/fiscal");
  revalidatePath("/fiscal/expenses");
  redirect("/fiscal/expenses");
}
