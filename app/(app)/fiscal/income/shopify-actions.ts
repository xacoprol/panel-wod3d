"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/session";
import {
  lastDaysRange,
  monthRange,
  syncShopifyOrders,
} from "@/lib/shopify-sync";
import {
  getShopifyCredentials,
  testShopifyConnection,
} from "@/lib/shopify-client";

export type ShopifySyncActionResult =
  | {
      ok: true;
      message: string;
      created: number;
      updated: number;
      fetched: number;
    }
  | { ok: false; error: string };

export async function syncShopifyMonthAction(
  year: number,
  month: number
): Promise<ShopifySyncActionResult> {
  await requireAuth();
  try {
    const y = Math.trunc(year);
    const m = Math.trunc(month);
    if (y < 2020 || y > 2100 || m < 1 || m > 12) {
      return { ok: false, error: "Periodo no válido" };
    }
    const { from, to } = monthRange(y, m);
    const result = await syncShopifyOrders({ from, to, mode: "created" });
    if (!result.ok) return result;

    revalidatePath("/fiscal");
    revalidatePath("/fiscal/income");
    revalidatePath("/fiscal/303");
    revalidatePath("/settings");

    return {
      ok: true,
      message: `Shopify ${m}/${y}: ${result.created} nuevos, ${result.updated} actualizados (${result.fetched} pedidos leídos).`,
      created: result.created,
      updated: result.updated,
      fetched: result.fetched,
    };
  } catch (e) {
    console.error("[syncShopifyMonthAction]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al sincronizar",
    };
  }
}

export async function syncShopifyRecentAction(
  days = 60
): Promise<ShopifySyncActionResult> {
  await requireAuth();
  try {
    const { from, to } = lastDaysRange(days);
    const result = await syncShopifyOrders({ from, to, mode: "updated" });
    if (!result.ok) return result;

    revalidatePath("/fiscal");
    revalidatePath("/fiscal/income");
    revalidatePath("/fiscal/303");
    revalidatePath("/settings");

    return {
      ok: true,
      message: `Shopify (últimos ${days} días): ${result.created} nuevos, ${result.updated} actualizados (${result.fetched} pedidos).`,
      created: result.created,
      updated: result.updated,
      fetched: result.fetched,
    };
  } catch (e) {
    console.error("[syncShopifyRecentAction]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al sincronizar",
    };
  }
}

export async function testShopifyConnectionAction(): Promise<
  { ok: true; shopName: string } | { ok: false; error: string }
> {
  await requireAuth();
  try {
    const creds = await getShopifyCredentials();
    if (!creds) {
      return {
        ok: false,
        error: "Falta tienda o Client ID/Secret (Ajustes · Dev Dashboard).",
      };
    }
    return await testShopifyConnection(creds);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo conectar",
    };
  }
}
