import {
  isAmazonTaxReport,
  parseAmazonTaxReportCsv,
  parseCsv,
  type AmazonTaxReportParseResult,
  type MarketplaceChannel,
} from "@/lib/amazon-tax-report";
import {
  isShopifySalesByCountryReport,
  parseShopifySalesByCountryCsv,
} from "@/lib/shopify-sales-report";

export type DetectedMarketplaceParse = AmazonTaxReportParseResult & {
  channel: MarketplaceChannel;
  needsPeriodDate: boolean;
};

/** Detecta Amazon VAT tax report o Shopify sales-by-country y parsea. */
export function parseMarketplaceIncomeCsv(
  text: string,
  sourceFile?: string
): DetectedMarketplaceParse {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  if (table.length < 2) {
    throw new Error("El CSV está vacío o no tiene filas de datos");
  }
  const headers = table[0].map((h) => h.trim().replace(/^"|"$/g, ""));

  if (isAmazonTaxReport(headers)) {
    const parsed = parseAmazonTaxReportCsv(text, sourceFile);
    return { ...parsed, channel: "AMAZON", needsPeriodDate: false };
  }

  if (isShopifySalesByCountryReport(headers)) {
    const parsed = parseShopifySalesByCountryCsv(text, sourceFile);
    return { ...parsed, channel: "SHOPIFY", needsPeriodDate: true };
  }

  throw new Error(
    "Formato no reconocido. Usa el VAT Tax Report de Amazon o el export de Shopify por país de facturación (Billing country / Net sales / Taxes)."
  );
}
