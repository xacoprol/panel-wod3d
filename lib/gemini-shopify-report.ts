/**
 * OCR del Informe IVA / resumen de ventas Shopify (captura, PDF o chat/email).
 */
import {
  geminiConfigured,
  generateJsonWithFallback,
  getGeminiApiKey,
  resolveUploadMime,
} from "@/lib/gemini-client";
import type { ShopifyIvaSummaryDraft } from "@/lib/shopify-sales-report";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 12 * 1024 * 1024;

const MONTH_ES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export { geminiConfigured };

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return round2(raw);
  let s = String(raw ?? "")
    .trim()
    .replace(/€/g, "")
    .replace(/\s/g, "");
  if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

function parsePeriodFromLabel(label: string): {
  year: number;
  month: number;
} | null {
  // «enero de 2026», «Abril 2026», «Informe IVA — Abril 2026»
  const m =
    /([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(?:de\s+)?(\d{4})/.exec(label) ||
    /(\d{4})-(\d{1,2})/.exec(label);
  if (!m) return null;

  if (/^\d{4}$/.test(m[1])) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (year && month >= 1 && month <= 12) return { year, month };
    return null;
  }

  const month =
    MONTH_ES[
      m[1]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    ];
  const year = parseInt(m[2], 10);
  if (!month || !year) return null;
  return { year, month };
}

function parseDraftFromText(text: string): ShopifyIvaSummaryDraft {
  if (!text.trim()) {
    throw new Error("Gemini no devolvió datos del Informe IVA");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No se pudo interpretar la respuesta de Gemini");
    parsed = JSON.parse(m[0]) as Record<string, unknown>;
  }

  let periodYear = Math.trunc(Number(parsed.periodYear) || 0);
  let periodMonth = Math.trunc(Number(parsed.periodMonth) || 0);
  const periodLabel = String(parsed.periodLabel ?? "").trim() || null;

  if ((!periodYear || !periodMonth) && periodLabel) {
    const fromLabel = parsePeriodFromLabel(periodLabel);
    if (fromLabel) {
      periodYear = periodYear || fromLabel.year;
      periodMonth = periodMonth || fromLabel.month;
    }
  }

  if (!periodYear || periodMonth < 1 || periodMonth > 12) {
    throw new Error(
      "No se pudo leer el mes/año del Informe IVA (ej. enero de 2026)"
    );
  }

  const grossSales = parseMoney(parsed.grossSales);
  const discounts = parseMoney(parsed.discounts);
  const returns = parseMoney(parsed.returns);
  let netSales = parseMoney(parsed.netSales);
  const shipping = parseMoney(parsed.shipping);
  const taxes = parseMoney(parsed.taxes);
  let totalSales = parseMoney(parsed.totalSales);
  const orders = Math.max(0, Math.trunc(Number(parsed.orders) || 0));
  const reportKindRaw = String(parsed.reportKind ?? "")
    .toLowerCase()
    .trim();
  const reportKind =
    reportKindRaw === "chat" || reportKindRaw === "table"
      ? reportKindRaw
      : netSales || shipping || grossSales
        ? "table"
        : "chat";
  const notes = String(parsed.notes ?? "").trim() || null;

  if (!netSales && (grossSales || discounts || returns)) {
    netSales = round2(grossSales + discounts + returns);
  }
  // Chat: Total de ventas + IVA → base = total − IVA
  if (!netSales && !shipping && totalSales) {
    netSales = taxes ? round2(totalSales - taxes) : totalSales;
  }
  if (!totalSales) {
    totalSales = round2(netSales + shipping + taxes);
  }

  const confidenceRaw = String(parsed.confidence ?? "medium").toLowerCase();
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  return {
    periodYear,
    periodMonth,
    periodLabel:
      periodLabel ||
      `Informe IVA ${periodYear}-${String(periodMonth).padStart(2, "0")}`,
    grossSales,
    discounts,
    returns,
    netSales,
    shipping,
    taxes,
    totalSales,
    orders,
    reportKind,
    notes,
    confidence,
  };
}

export async function parseShopifyIvaReportDocument(file: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ShopifyIvaSummaryDraft> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Falta GEMINI_API_KEY (o GOOGLE_API_KEY) en las variables de entorno"
    );
  }

  const mime = resolveUploadMime(file.mimeType, file.fileName);
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Formato no soportado. Usa PDF, JPG, PNG o WebP");
  }
  if (file.buffer.byteLength > MAX_BYTES) {
    throw new Error("El archivo supera 12 MB");
  }

  const prompt = `Eres un asistente fiscal. Extrae los datos de un INFORME IVA / resumen de ventas de Shopify (captura, PDF o mensaje de chat/email).

Hay DOS formatos habituales:

1) TABLA «Informe IVA — Abril 2026» con filas:
Ventas brutas, Descuentos, Devoluciones, Ventas netas, Gastos de envío, IVA recaudado, Total ventas.

2) RESUMEN EN TEXTO / CHAT / EMAIL, p. ej.:
«Aquí está tu informe de IVA para enero de 2026:
Resumen del mes
• Total de ventas: 789,64 €
• Total de IVA recaudado: 136,99 €
• Número de pedidos: 29
Desglose por pedido (opcional)…»
En este caso NO hay ventas netas ni envío desglosados: usa totalSales e taxes (y orders). netSales/shipping = 0.

Devuelve SOLO un JSON válido:
{
  "reportKind": "table" | "chat",
  "periodYear": 2026,
  "periodMonth": 1,
  "periodLabel": "Informe IVA enero 2026",
  "grossSales": 0,
  "discounts": 0,
  "returns": 0,
  "netSales": 0,
  "shipping": 0,
  "taxes": 136.99,
  "totalSales": 789.64,
  "orders": 29,
  "notes": "devoluciones u observaciones relevantes, o null",
  "confidence": "high" | "medium" | "low"
}

Reglas:
- Importes en euros con punto decimal (789,64 → 789.64). Descuentos/devoluciones pueden ser negativos.
- periodMonth 1–12. «enero de 2026» → periodYear=2026, periodMonth=1.
- table: netSales=Ventas netas, shipping=Gastos de envío, taxes=IVA recaudado, totalSales=Total ventas.
- chat: totalSales=Total de ventas, taxes=Total de IVA recaudado, orders=Número de pedidos; gross/net/shipping=0 si no aparecen.
- Si menciona una devolución (importe negativo), anótala en notes; no inventes líneas extra.
- No inventes cifras. Si falta un campo, 0 o null.
- Archivo: ${file.fileName}`;

  const base64 = file.buffer.toString("base64");
  const text = await generateJsonWithFallback({
    apiKey,
    mime,
    base64,
    prompt,
  });
  return parseDraftFromText(text);
}
