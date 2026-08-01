import { prisma } from "@/lib/prisma";

const API_VERSION = "2025-01";

export type ShopifyCredentials = {
  shop: string; // xxx.myshopify.com
  accessToken: string;
};

export function normalizeShopifyShop(raw: string): string | null {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!s) return null;
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  if (!s.endsWith(".myshopify.com")) {
    // dominio custom → no sirve para Admin API; pedir .myshopify.com
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) {
      return null;
    }
  }
  return s;
}

/** Credenciales: Ajustes (BD) o variables de entorno. */
export async function getShopifyCredentials(): Promise<ShopifyCredentials | null> {
  const settings = await prisma.companySettings.findFirst({
    select: { shopifyShop: true, shopifyAccessToken: true },
  });
  const shop =
    normalizeShopifyShop(settings?.shopifyShop ?? "") ||
    normalizeShopifyShop(process.env.SHOPIFY_SHOP ?? "");
  const accessToken =
    (settings?.shopifyAccessToken ?? "").trim() ||
    (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim() ||
    (process.env.SHOPIFY_ACCESS_TOKEN ?? "").trim();

  if (!shop || !accessToken) return null;
  return { shop, accessToken };
}

export function shopifyConfiguredHint(settings: {
  shopifyShop: string | null;
  shopifyAccessToken: string | null;
}): { ready: boolean; shop: string | null; hasToken: boolean } {
  const shop =
    normalizeShopifyShop(settings.shopifyShop ?? "") ||
    normalizeShopifyShop(process.env.SHOPIFY_SHOP ?? "");
  const hasToken = Boolean(
    (settings.shopifyAccessToken ?? "").trim() ||
      (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim() ||
      (process.env.SHOPIFY_ACCESS_TOKEN ?? "").trim()
  );
  return { ready: Boolean(shop && hasToken), shop, hasToken };
}

type ShopifyListOrdersParams = {
  createdAtMin?: string; // ISO
  createdAtMax?: string;
  updatedAtMin?: string;
  limit?: number;
};

export type ShopifyOrder = {
  id: number;
  name: string;
  created_at: string;
  processed_at: string | null;
  cancelled_at: string | null;
  financial_status: string | null;
  taxes_included: boolean;
  total_price: string;
  total_tax: string;
  subtotal_price: string;
  currency: string;
  billing_address?: { country_code?: string | null } | null;
  shipping_address?: { country_code?: string | null } | null;
  tax_lines?: {
    price?: string;
    rate?: number;
    channel_liable?: boolean | null;
  }[];
};

async function shopifyFetch(
  creds: ShopifyCredentials,
  path: string
): Promise<Response> {
  const url = `https://${creds.shop}/admin/api/${API_VERSION}${path}`;
  return fetch(url, {
    headers: {
      "X-Shopify-Access-Token": creds.accessToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

/** Sigue Link rel="next" de Shopify (cursor pagination). */
function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = /<([^>]+)>\s*;\s*rel="next"/i.exec(part.trim());
    if (m) return m[1];
  }
  return null;
}

export async function fetchShopifyOrders(
  creds: ShopifyCredentials,
  params: ShopifyListOrdersParams
): Promise<ShopifyOrder[]> {
  const qs = new URLSearchParams();
  qs.set("status", "any");
  qs.set("limit", String(Math.min(params.limit ?? 250, 250)));
  if (params.createdAtMin) qs.set("created_at_min", params.createdAtMin);
  if (params.createdAtMax) qs.set("created_at_max", params.createdAtMax);
  if (params.updatedAtMin) qs.set("updated_at_min", params.updatedAtMin);
  qs.set(
    "fields",
    [
      "id",
      "name",
      "created_at",
      "processed_at",
      "cancelled_at",
      "financial_status",
      "taxes_included",
      "total_price",
      "total_tax",
      "subtotal_price",
      "currency",
      "billing_address",
      "shipping_address",
      "tax_lines",
    ].join(",")
  );

  let nextUrl: string | null =
    `https://${creds.shop}/admin/api/${API_VERSION}/orders.json?${qs}`;
  const all: ShopifyOrder[] = [];
  let pages = 0;

  while (nextUrl) {
    pages++;
    if (pages > 40) {
      throw new Error(
        "Demasiados pedidos en el periodo (>10.000). Acota el rango de fechas."
      );
    }
    const res = await fetch(nextUrl, {
      headers: {
        "X-Shopify-Access-Token": creds.accessToken,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "Shopify rechazó el token (401/403). Revisa la app personalizada y el scope read_orders."
        );
      }
      throw new Error(
        `Shopify API ${res.status}: ${body.slice(0, 200) || res.statusText}`
      );
    }
    const json = (await res.json()) as { orders?: ShopifyOrder[] };
    all.push(...(json.orders ?? []));
    nextUrl = nextPageUrl(res.headers.get("link"));
  }

  return all;
}

export async function testShopifyConnection(
  creds: ShopifyCredentials
): Promise<{ ok: true; shopName: string } | { ok: false; error: string }> {
  try {
    const res = await shopifyFetch(creds, "/shop.json");
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401 || res.status === 403
            ? "Token no válido o sin permisos"
            : `Error Shopify ${res.status}`,
      };
    }
    const json = (await res.json()) as { shop?: { name?: string } };
    return { ok: true, shopName: json.shop?.name ?? creds.shop };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo conectar",
    };
  }
}
