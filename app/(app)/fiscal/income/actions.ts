"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { parseMarketplaceIncomeCsv } from "@/lib/marketplace-income-parse";
import type { AmazonTaxReportRow } from "@/lib/amazon-tax-report";

export type ParseMarketplaceIncomeResult =
  | {
      ok: true;
      channel: "AMAZON" | "SHOPIFY";
      needsPeriodDate: boolean;
      rows: AmazonTaxReportRow[];
      summary: {
        count: number;
        taxableBase: number;
        taxableVat: number;
        exemptBase: number;
        marketplaceCollectedBase: number;
        marketplaceCollectedVatSkipped: number;
        refundsBase: number;
      };
      sourceFile: string;
    }
  | { ok: false; error: string };

export async function parseMarketplaceIncomeUpload(
  formData: FormData
): Promise<ParseMarketplaceIncomeResult> {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona un CSV del informe" };
  }

  const name = file.name.toLowerCase();
  if (
    !name.endsWith(".csv") &&
    file.type &&
    !file.type.includes("csv") &&
    !file.type.includes("text")
  ) {
    return {
      ok: false,
      error: "Sube un CSV (Amazon VAT Tax Report o Shopify por país).",
    };
  }

  try {
    const text = await file.text();
    const parsed = parseMarketplaceIncomeCsv(text, file.name);
    return {
      ok: true,
      channel: parsed.channel,
      needsPeriodDate: parsed.needsPeriodDate,
      rows: parsed.rows,
      summary: parsed.summary,
      sourceFile: file.name,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "No se pudo leer el CSV. Formatos: Amazon tax report o Shopify (Billing country).",
    };
  }
}

export type MarketplaceIncomeInput = {
  channel: string;
  issueDate: string;
  externalKey: string;
  externalRef?: string | null;
  orderId?: string | null;
  sku?: string | null;
  description?: string | null;
  transactionType: string;
  vatStatus: string;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  shipToCountry?: string | null;
  sourceFile?: string | null;
  notes?: string | null;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function importMarketplaceIncomeRows(
  rows: MarketplaceIncomeInput[]
): Promise<
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string }
> {
  await requireAuth();

  if (!rows.length) {
    return { ok: false, error: "No hay filas para importar" };
  }

  let imported = 0;
  let skipped = 0;

  try {
    for (const row of rows) {
      const channel = String(row.channel || "AMAZON").toUpperCase();
      const externalKey = String(row.externalKey || "").trim();
      if (!externalKey) {
        skipped++;
        continue;
      }

      const existing = await prisma.marketplaceIncome.findUnique({
        where: {
          channel_externalKey: { channel, externalKey },
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const issueDate = row.issueDate ? new Date(row.issueDate) : new Date();
      const subtotal = round2(Number(row.subtotal) || 0);
      const vatAmount = round2(Number(row.vatAmount) || 0);
      const total =
        row.total != null
          ? round2(Number(row.total) || 0)
          : round2(subtotal + vatAmount);

      await prisma.marketplaceIncome.create({
        data: {
          channel,
          issueDate,
          externalKey,
          externalRef: row.externalRef?.trim() || null,
          orderId: row.orderId?.trim() || null,
          sku: row.sku?.trim() || null,
          description: row.description?.trim() || null,
          transactionType: row.transactionType || "SHIPMENT",
          vatStatus: row.vatStatus || "TAXABLE",
          vatRate: Number(row.vatRate) || 0,
          subtotal,
          vatAmount,
          total,
          shipToCountry: row.shipToCountry?.trim() || null,
          sourceFile: row.sourceFile?.trim() || null,
          notes: row.notes?.trim() || null,
        },
      });
      imported++;
    }

    revalidatePath("/fiscal");
    revalidatePath("/fiscal/income");
    revalidatePath("/fiscal/303");
    revalidatePath("/fiscal/130");
    return { ok: true, imported, skipped };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al importar",
    };
  }
}

export async function deleteMarketplaceIncome(id: string) {
  await requireAuth();
  await prisma.marketplaceIncome.delete({ where: { id } });
  revalidatePath("/fiscal");
  revalidatePath("/fiscal/income");
  redirect("/fiscal/income");
}
