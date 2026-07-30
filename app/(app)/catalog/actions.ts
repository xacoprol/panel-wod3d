"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export type CatalogFormState = { error?: string };

function parseCatalogForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    unitPrice: parseFloat(String(formData.get("unitPrice") ?? "0")) || 0,
    vatRate: parseFloat(String(formData.get("vatRate") ?? "21")) || 0,
    defaultDiscountPct:
      parseFloat(String(formData.get("defaultDiscountPct") ?? "0")) || 0,
    active: formData.get("active") === "on" || formData.get("active") === "1",
  };
}

function validate(data: ReturnType<typeof parseCatalogForm>) {
  if (!data.name) return "El nombre corto es obligatorio";
  if (!data.description) return "La descripción es obligatoria";
  if (data.unitPrice < 0) return "El precio no puede ser negativo";
  return null;
}

export async function createCatalogItem(
  _prev: CatalogFormState,
  formData: FormData
): Promise<CatalogFormState> {
  await requireAuth();
  try {
    const data = parseCatalogForm(formData);
    const err = validate(data);
    if (err) return { error: err };

    await prisma.catalogItem.create({
      data: {
        ...data,
        active: formData.has("active"),
      },
    });
    revalidatePath("/catalog");
    redirect("/catalog");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : "Error al crear" };
  }
}

export async function updateCatalogItem(
  id: string,
  _prev: CatalogFormState,
  formData: FormData
): Promise<CatalogFormState> {
  await requireAuth();
  try {
    const data = parseCatalogForm(formData);
    const err = validate(data);
    if (err) return { error: err };

    await prisma.catalogItem.update({
      where: { id },
      data,
    });
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${id}/edit`);
    redirect("/catalog");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }
}

export async function deleteCatalogItem(id: string) {
  await requireAuth();
  await prisma.catalogItem.delete({ where: { id } });
  revalidatePath("/catalog");
  redirect("/catalog");
}

export async function toggleCatalogItemActive(id: string) {
  await requireAuth();
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) throw new Error("Concepto no encontrado");
  await prisma.catalogItem.update({
    where: { id },
    data: { active: !item.active },
  });
  revalidatePath("/catalog");
}

/** Quick-save a line into the catalog (from document editor). */
export async function saveLineToCatalog(input: {
  name?: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  discountPct?: number;
}): Promise<{ ok: true; id: string } | { error: string }> {
  await requireAuth();
  const description = input.description.trim();
  if (!description) return { error: "Falta la descripción" };
  const name = (input.name?.trim() || description).slice(0, 80);
  const item = await prisma.catalogItem.create({
    data: {
      name,
      description,
      unitPrice: input.unitPrice || 0,
      vatRate: input.vatRate ?? 21,
      defaultDiscountPct: input.discountPct ?? 0,
      active: true,
    },
  });
  revalidatePath("/catalog");
  return { ok: true, id: item.id };
}
