import { prisma } from "@/lib/prisma";

const API_VERSION = "2025-01";

export type ShopifyCredentials = {
  shop: string; // xxx.myshopify.com
  /** Token listo para X-Shopify-Access-Token */
  accessToken: string;
};

type ShopifyAuthConfig = {
  shop: string;
  clientId?: string;
  clientSecret?: string;
  /** Token legacy fijo (apps admin antiguas) */
  staticAccessToken?: string;
};

export function normalizeShopifyShop(raw: string): string | null {
  let s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!s) return null;
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) {
    return null;
  }
  return s;
}

async function loadAuthConfig(): Promise<ShopifyAuthConfig | null> {
  const settings = await prisma.companySettings.findFirst({
    select: {
      shopifyShop: true,
      shopifyClientId: true,
      shopifyClientSecret: true,
      shopifyAccessToken: true,
    },
  });

  const shop =
    normalizeShopifyShop(settings?.shopifyShop ?? "") ||
    normalizeShopifyShop(process.env.SHOPIFY_SHOP ?? "");
  if (!shop) return null;

  const clientId =
    (settings?.shopifyClientId ?? "").trim() ||
    (process.env.SHOPIFY_CLIENT_ID ?? "").trim() ||
    undefined;
  const clientSecret =
    (settings?.shopifyClientSecret ?? "").trim() ||
    (process.env.SHOPIFY_CLIENT_SECRET ?? "").trim() ||
    undefined;
  const staticAccessToken =
    (settings?.shopifyAccessToken ?? "").trim() ||
    (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim() ||
    (process.env.SHOPIFY_ACCESS_TOKEN ?? "").trim() ||
    undefined;

  if (!clientId && !clientSecret && !staticAccessToken) return null;
  return { shop, clientId, clientSecret, staticAccessToken };
}

/** Cache en memoria del token de client_credentials (caduca ~24 h). */
let cachedToken: { shop: string; token: string; expiresAt: number } | null =
  null;

async function fetchClientCredentialsToken(
  shop: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  let json: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* ignore */
  }
  if (!res.ok || !json.access_token) {
    const detail =
      json.error_description ||
      json.error ||
      text.slice(0, 180) ||
      res.statusText;
    if (String(detail).includes("shop_not_permitted")) {
      throw new Error(
        "Shopify: client credentials no permitido en esta tienda. La app del Dev Dashboard debe estar en la misma organización e instalada en la tienda."
      );
    }
    throw new Error(`Shopify OAuth ${res.status}: ${detail}`);
  }
  const expiresIn = Number(json.expires_in) || 86399;
  cachedToken = {
    shop,
    token: json.access_token,
    expiresAt: Date.now() + (expiresIn - 120) * 1000,
  };
  return json.access_token;
}

export async function getShopifyCredentials(): Promise<ShopifyCredentials | null> {
  const cfg = await loadAuthConfig();
  if (!cfg) return null;

  if (cfg.clientId && cfg.clientSecret) {
    if (
      cachedToken &&
      cachedToken.shop === cfg.shop &&
      cachedToken.expiresAt > Date.now()
    ) {
      return { shop: cfg.shop, accessToken: cachedToken.token };
    }
    const accessToken = await fetchClientCredentialsToken(
      cfg.shop,
      cfg.clientId,
      cfg.clientSecret
    );
    return { shop: cfg.shop, accessToken };
  }

  if (cfg.staticAccessToken) {
    return { shop: cfg.shop, accessToken: cfg.staticAccessToken };
  }

  return null;
}

export function shopifyConfiguredHint(settings: {
  shopifyShop: string | null;
  shopifyClientId?: string | null;
  shopifyClientSecret?: string | null;
  shopifyAccessToken: string | null;
}): { ready: boolean; shop: string | null; hasToken: boolean } {
  const shop =
    normalizeShopifyShop(settings.shopifyShop ?? "") ||
    normalizeShopifyShop(process.env.SHOPIFY_SHOP ?? "");
  const hasClientCreds = Boolean(
    ((settings.shopifyClientId ?? "").trim() ||
      (process.env.SHOPIFY_CLIENT_ID ?? "").trim()) &&
      ((settings.shopifyClientSecret ?? "").trim() ||
        (process.env.SHOPIFY_CLIENT_SECRET ?? "").trim())
  );
  const hasStatic = Boolean(
    (settings.shopifyAccessToken ?? "").trim() ||
      (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ?? "").trim() ||
      (process.env.SHOPIFY_ACCESS_TOKEN ?? "").trim()
  );
  const hasToken = hasClientCreds || hasStatic;
  return { ready: Boolean(shop && hasToken), shop, hasToken };
}

type ShopifyListOrdersParams = {
  createdAtMin?: string;
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

function nextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
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
          "Shopify rechazó el acceso (401/403). Revisa Client ID/Secret, que la app esté instalada y el scope read_orders."
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
    const res = await fetch(
      `https://${creds.shop}/admin/api/${API_VERSION}/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": creds.accessToken,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      return {
        ok: false,
        error:
          res.status === 401 || res.status === 403
            ? "Credenciales no válidas o app sin instalar / sin read_orders"
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
