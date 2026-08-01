import { prisma } from "@/lib/prisma";

const API_VERSION = "2025-01";

export type ShopifyCredentials = {
  shop: string;
  accessToken: string;
};

type ShopifyAuthConfig = {
  shop: string;
  clientId?: string;
  clientSecret?: string;
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

  if ((!clientId || !clientSecret) && !staticAccessToken) return null;
  return { shop, clientId, clientSecret, staticAccessToken };
}

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
    cachedToken = null;
    const detail =
      json.error_description ||
      json.error ||
      text.slice(0, 180) ||
      res.statusText;
    if (String(detail).includes("shop_not_permitted")) {
      throw new Error(
        "Shopify: client credentials no permitido. La app debe ser de tu organización e instalada en esta tienda."
      );
    }
    if (String(detail).toLowerCase().includes("invalid_client")) {
      throw new Error(
        "Client ID o Client secret incorrectos. Cópialos de nuevo desde Dev Dashboard → Settings."
      );
    }
    throw new Error(`Shopify OAuth: ${detail}`);
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
  return { ready: Boolean(shop && (hasClientCreds || hasStatic)), shop, hasToken: hasClientCreds || hasStatic };
}

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

type GqlMoney = { amount?: string; currencyCode?: string };
type GqlOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  processedAt?: string | null;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  taxesIncluded?: boolean;
  totalPriceSet?: { shopMoney?: GqlMoney };
  totalTaxSet?: { shopMoney?: GqlMoney };
  subtotalPriceSet?: { shopMoney?: GqlMoney };
  billingAddress?: { countryCodeV2?: string | null } | null;
  shippingAddress?: { countryCodeV2?: string | null } | null;
  taxLines?: {
    rate?: number | null;
    channelLiable?: boolean | null;
    priceSet?: { shopMoney?: GqlMoney };
  }[];
};

async function shopifyGraphql<T>(
  creds: ShopifyCredentials,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(
    `https://${creds.shop}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": creds.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    }
  );
  const text = await res.text();
  let json: {
    data?: T;
    errors?: { message?: string }[];
  } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    cachedToken = null;
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Shopify 401/403: revisa Client ID/Secret, que la app esté instalada y el scope read_orders en la versión lanzada."
      );
    }
    throw new Error(
      `Shopify GraphQL HTTP ${res.status}: ${text.slice(0, 200)}`
    );
  }
  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    if (/access|denied|scope|permission/i.test(msg)) {
      throw new Error(
        `Shopify sin permiso: ${msg}. En Dev Dashboard → Versions añade read_orders (y read_all_orders si quieres histórico), Release e reinstala la app.`
      );
    }
    throw new Error(`Shopify GraphQL: ${msg}`);
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL: respuesta vacía");
  }
  return json.data;
}

function gidToOrderId(gid: string): number {
  const m = /Order\/(\d+)/.exec(gid);
  return m ? Number(m[1]) : Number(gid.replace(/\D/g, "")) || 0;
}

function mapGqlOrder(node: GqlOrderNode): ShopifyOrder | null {
  const id = gidToOrderId(node.id);
  if (!id) return null;
  const currency =
    node.totalPriceSet?.shopMoney?.currencyCode ||
    node.subtotalPriceSet?.shopMoney?.currencyCode ||
    "EUR";
  return {
    id,
    name: node.name,
    created_at: node.createdAt,
    processed_at: node.processedAt ?? null,
    cancelled_at: node.cancelledAt ?? null,
    financial_status: (node.displayFinancialStatus || "").toLowerCase() || null,
    taxes_included: Boolean(node.taxesIncluded),
    total_price: node.totalPriceSet?.shopMoney?.amount ?? "0",
    total_tax: node.totalTaxSet?.shopMoney?.amount ?? "0",
    subtotal_price: node.subtotalPriceSet?.shopMoney?.amount ?? "0",
    currency,
    billing_address: {
      country_code: node.billingAddress?.countryCodeV2 ?? null,
    },
    shipping_address: {
      country_code: node.shippingAddress?.countryCodeV2 ?? null,
    },
    tax_lines: (node.taxLines ?? []).map((t) => ({
      price: t.priceSet?.shopMoney?.amount ?? "0",
      rate: t.rate ?? undefined,
      channel_liable: t.channelLiable ?? null,
    })),
  };
}

const ORDER_NODE_FIELDS = `
  id
  name
  createdAt
  processedAt
  cancelledAt
  displayFinancialStatus
  taxesIncluded
  totalPriceSet { shopMoney { amount currencyCode } }
  totalTaxSet { shopMoney { amount } }
  subtotalPriceSet { shopMoney { amount } }
  billingAddress { countryCodeV2 }
  shippingAddress { countryCodeV2 }
  taxLines {
    rate
    channelLiable
    priceSet { shopMoney { amount } }
  }
`;

type ShopifyListOrdersParams = {
  createdAtMin?: string;
  createdAtMax?: string;
  updatedAtMin?: string;
};

export async function fetchShopifyOrders(
  creds: ShopifyCredentials,
  params: ShopifyListOrdersParams
): Promise<ShopifyOrder[]> {
  const parts: string[] = [];
  if (params.updatedAtMin) {
    parts.push(`updated_at:>='${params.updatedAtMin}'`);
  } else {
    if (params.createdAtMin) {
      parts.push(`created_at:>='${params.createdAtMin}'`);
    }
    if (params.createdAtMax) {
      parts.push(`created_at:<='${params.createdAtMax}'`);
    }
  }
  const queryFilter = parts.join(" ");

  // Query sin variable $query vacía (Shopify a veces falla con null)
  const query = queryFilter
    ? `
    query OrdersPage($cursor: String, $q: String!) {
      orders(first: 50, after: $cursor, query: $q, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_NODE_FIELDS} }
      }
    }
  `
    : `
    query OrdersPage($cursor: String) {
      orders(first: 50, after: $cursor, sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes { ${ORDER_NODE_FIELDS} }
      }
    }
  `;

  const all: ShopifyOrder[] = [];
  let cursor: string | null = null;
  let pages = 0;

  for (;;) {
    pages++;
    if (pages > 80) {
      throw new Error(
        "Demasiados pedidos en el periodo. Acota el rango de fechas."
      );
    }
    type PageData = {
      orders?: {
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        nodes: GqlOrderNode[];
      } | null;
    };
    const variables: Record<string, unknown> = { cursor };
    if (queryFilter) variables.q = queryFilter;

    const data: PageData = await shopifyGraphql<PageData>(
      creds,
      query,
      variables
    );
    const conn = data.orders;
    if (!conn) {
      throw new Error(
        "Shopify no devolvió pedidos. ¿Scope read_orders activo e app instalada?"
      );
    }
    for (const node of conn.nodes ?? []) {
      const mapped = mapGqlOrder(node);
      if (mapped) all.push(mapped);
    }
    if (!conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor ?? null;
    if (!cursor) break;
  }

  return all;
}

export async function testShopifyConnection(
  creds: ShopifyCredentials
): Promise<{ ok: true; shopName: string } | { ok: false; error: string }> {
  try {
    const data = await shopifyGraphql<{ shop: { name?: string } }>(
      creds,
      `{ shop { name } }`
    );
    return { ok: true, shopName: data.shop?.name ?? creds.shop };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo conectar",
    };
  }
}
