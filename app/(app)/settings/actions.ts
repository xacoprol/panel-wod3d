"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { normalizeTaxId, taxIdErrorMessage } from "@/lib/nif";
import { DEFAULT_THEME, sanitizeHex } from "@/lib/theme";

export type SettingsState = { error?: string; success?: boolean };

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireAuth();
  const nif = normalizeTaxId(String(formData.get("nif") ?? ""));
  const nifErr = taxIdErrorMessage(nif, "ES");
  if (nif && nifErr) return { error: nifErr };

  const data = {
    name: String(formData.get("name") ?? "").trim(),
    nif,
    addressStreet: String(formData.get("addressStreet") ?? "").trim(),
    addressCity: String(formData.get("addressCity") ?? "").trim(),
    addressProvince: String(formData.get("addressProvince") ?? "").trim(),
    addressZip: String(formData.get("addressZip") ?? "").trim(),
    addressCountry: String(formData.get("addressCountry") ?? "España").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
    defaultVatRate: parseFloat(String(formData.get("defaultVatRate") ?? "21")),
    defaultIrpfRate: parseFloat(String(formData.get("defaultIrpfRate") ?? "15")),
    emailSubject: String(formData.get("emailSubject") ?? "").trim(),
    emailBody: String(formData.get("emailBody") ?? "").trim(),
    bankIban: String(formData.get("bankIban") ?? "").trim() || null,
    bankName: String(formData.get("bankName") ?? "").trim() || null,
    themeBg: sanitizeHex(
      String(formData.get("themeBg") ?? ""),
      DEFAULT_THEME.themeBg
    ),
    themeBgElevated: sanitizeHex(
      String(formData.get("themeBgElevated") ?? ""),
      DEFAULT_THEME.themeBgElevated
    ),
    themeInk: sanitizeHex(
      String(formData.get("themeInk") ?? ""),
      DEFAULT_THEME.themeInk
    ),
    themeInkMuted: sanitizeHex(
      String(formData.get("themeInkMuted") ?? ""),
      DEFAULT_THEME.themeInkMuted
    ),
    themeLine: sanitizeHex(
      String(formData.get("themeLine") ?? ""),
      DEFAULT_THEME.themeLine
    ),
    themeAccent: sanitizeHex(
      String(formData.get("themeAccent") ?? ""),
      DEFAULT_THEME.themeAccent
    ),
    themeAccentHover: sanitizeHex(
      String(formData.get("themeAccentHover") ?? ""),
      DEFAULT_THEME.themeAccentHover
    ),
    themeAccentSoft: sanitizeHex(
      String(formData.get("themeAccentSoft") ?? ""),
      DEFAULT_THEME.themeAccentSoft
    ),
    themeSidebar: sanitizeHex(
      String(formData.get("themeSidebar") ?? ""),
      DEFAULT_THEME.themeSidebar
    ),
    themeSidebarText: sanitizeHex(
      String(formData.get("themeSidebarText") ?? ""),
      DEFAULT_THEME.themeSidebarText
    ),
  };

  const existing = await prisma.companySettings.findFirst();
  if (existing) {
    await prisma.companySettings.update({ where: { id: existing.id }, data });
  } else {
    await prisma.companySettings.create({ data });
  }

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createInvoiceSeries(formData: FormData) {
  await requireAuth();
  const prefix = String(formData.get("prefix") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!prefix || !name) return;
  const yearEnabled = formData.get("useYear") === "on";
  await prisma.invoiceSeries.create({
    data: {
      prefix,
      name,
      nextNumber: 1,
      year: yearEnabled ? new Date().getFullYear() : null,
      padLength: 3,
      isDefault: false,
    },
  });
  revalidatePath("/settings");
}
