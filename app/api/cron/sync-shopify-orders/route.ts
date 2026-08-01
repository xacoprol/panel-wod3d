import { NextRequest, NextResponse } from "next/server";
import { lastDaysRange, syncShopifyOrders } from "@/lib/shopify-sync";
import { getShopifyCredentials } from "@/lib/shopify-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Sync incremental Shopify → MarketplaceIncome (últimos 7 días por updated_at).
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = await getShopifyCredentials();
  if (!creds) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "shopify-not-configured",
    });
  }

  const { from, to } = lastDaysRange(7);
  const result = await syncShopifyOrders({ from, to, mode: "updated" });
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}
