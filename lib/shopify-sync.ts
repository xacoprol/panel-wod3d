import { prisma } from "@/lib/prisma";
import type { AmazonTaxReportRow } from "@/lib/amazon-tax-report";
import {
  fetchShopifyOrders,
  getShopifyCredentials,
  type ShopifyOrder,
} from "@/lib/shopify-client";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(raw: string | number | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function dayKey(iso: string): string {
  // Shopify dates are ISO with offset; usar fecha local del instante UTC date part
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function inferVatRate(base: number, vat: number): number {
  if (Math.abs(base) < 0.005 || Math.abs(vat) < 0.005) return 0;
  const pct = round2((Math.abs(vat) / Math.abs(base)) * 100);
  const candidates = [0, 4, 10, 21, 23];
  let best = pct;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c - pct);
    if (d < bestDiff) {
      bestDiff = d;
      best = c;
    }
  }
  return bestDiff <= 1.5 ? best : pct;
}

function orderCountry(order: ShopifyOrder): string | null {
  const code =
    order.shipping_address?.country_code ||
    order.billing_address?.country_code ||
    null;
  return code ? String(code).toUpperCase().slice(0, 2) : null;
}

/**
 * Mapea un pedido Shopify → fila MarketplaceIncome.
 * Base = total − IVA (válido con taxes_included true/false).
 * Si tax_lines.channel_liable → MARKETPLACE_COLLECTED (OSS / canal).
 */
export function mapShopifyOrderToRow(order: ShopifyOrder): AmazonTaxReportRow | null {
  if (order.cancelled_at) return null;

  const financial = (order.financial_status || "").toLowerCase();
  // Pedidos sin cobro real no entran (pending, voided, …)
  if (
    financial &&
    !["paid", "partially_paid", "partially_refunded", "refunded"].includes(
      financial
    )
  ) {
    return null;
  }

  const total = round2(num(order.total_price));
  const vatAmount = round2(num(order.total_tax));
  const subtotal = round2(total - vatAmount);

  // Pedido a cero tras reembolso total: actualizar a 0 para no inflar el fiscal
  if (Math.abs(subtotal) < 0.005 && Math.abs(vatAmount) < 0.005 && Math.abs(total) < 0.005) {
    if (financial === "refunded") {
      // keep row at zero
    } else {
      return null;
    }
  }

  const channelLiable = (order.tax_lines ?? []).some(
    (t) => t.channel_liable === true
  );
  let vatStatus: AmazonTaxReportRow["vatStatus"] = "TAXABLE";
  if (channelLiable) {
    vatStatus = "MARKETPLACE_COLLECTED";
  } else if (Math.abs(vatAmount) < 0.005) {
    vatStatus = "EXEMPT";
  }

  const issueDate = dayKey(order.processed_at || order.created_at);
  const country = orderCountry(order);
  const vatRate =
    vatStatus === "TAXABLE"
      ? inferVatRate(subtotal, vatAmount)
      : order.tax_lines?.[0]?.rate != null
        ? round2(Number(order.tax_lines[0].rate) * 100)
        : 0;

  return {
    channel: "SHOPIFY",
    issueDate,
    externalKey: `order:${order.id}`,
    externalRef: order.name || String(order.id),
    orderId: order.name || String(order.id),
    sku: null,
    description: `Pedido Shopify ${order.name}`,
    transactionType: financial === "refunded" ? "REFUND" : "ORDER",
    vatStatus,
    vatRate,
    subtotal,
    vatAmount,
    total,
    shipToCountry: country,
    notes: channelLiable ? "IVA channel_liable (OSS / marketplace)" : null,
  };
}

export type ShopifySyncResult = {
  ok: true;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  from: string;
  to: string;
};

export type ShopifySyncError = { ok: false; error: string };

export async function syncShopifyOrders(options: {
  /** ISO date YYYY-MM-DD inclusive start (created_at) */
  from: string;
  /** ISO date YYYY-MM-DD inclusive end */
  to: string;
  /** Si true, usa updated_at_min = from (sync incremental) */
  mode?: "created" | "updated";
}): Promise<ShopifySyncResult | ShopifySyncError> {
  const creds = await getShopifyCredentials();
  if (!creds) {
    return {
      ok: false,
      error:
        "Shopify no configurado. Pon tienda + token en Ajustes, o SHOPIFY_SHOP y SHOPIFY_ADMIN_ACCESS_TOKEN en el entorno.",
    };
  }

  const fromDay = options.from.slice(0, 10);
  const toDay = options.to.slice(0, 10);
  const createdAtMin = `${fromDay}T00:00:00.000Z`;
  const createdAtMax = `${toDay}T23:59:59.999Z`;

  let orders: ShopifyOrder[];
  try {
    orders = await fetchShopifyOrders(
      creds,
      options.mode === "updated"
        ? { updatedAtMin: createdAtMin }
        : { createdAtMin, createdAtMax }
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al leer pedidos Shopify",
    };
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const order of orders) {
    const row = mapShopifyOrderToRow(order);
    if (!row) {
      skipped++;
      continue;
    }

    const issueDate = new Date(`${row.issueDate}T12:00:00.000Z`);
    const existing = await prisma.marketplaceIncome.findUnique({
      where: {
        channel_externalKey: {
          channel: "SHOPIFY",
          externalKey: row.externalKey,
        },
      },
      select: { id: true },
    });

    const data = {
      issueDate,
      externalRef: row.externalRef,
      orderId: row.orderId,
      description: row.description,
      transactionType: row.transactionType,
      vatStatus: row.vatStatus,
      vatRate: row.vatRate,
      subtotal: row.subtotal,
      vatAmount: row.vatAmount,
      total: row.total,
      shipToCountry: row.shipToCountry,
      sourceFile: "shopify-api",
      notes: row.notes,
    };

    if (existing) {
      await prisma.marketplaceIncome.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.marketplaceIncome.create({
        data: {
          channel: "SHOPIFY",
          externalKey: row.externalKey,
          ...data,
        },
      });
      created++;
    }
  }

  await prisma.companySettings.updateMany({
    data: { shopifyLastSyncAt: new Date() },
  });

  return {
    ok: true,
    fetched: orders.length,
    created,
    updated,
    skipped,
    from: fromDay,
    to: toDay,
  };
}

/** Rango del mes civil (1–12). */
export function monthRange(
  year: number,
  month: number
): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

/** Últimos N días hasta hoy (UTC date). */
export function lastDaysRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - Math.max(1, days));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
