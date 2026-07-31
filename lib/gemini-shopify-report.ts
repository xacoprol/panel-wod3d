/**
 * OCR del Informe IVA / resumen de ventas Shopify (captura o PDF).
 */
import { geminiConfigured } from "@/lib/gemini-expense";
import type { ShopifyIvaSummaryDraft } from "@/lib/shopify-sales-report";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 12 * 1024 * 1024;

const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

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

function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    null
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function rankModelName(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("flash-lite")) return 0;
  if (n.includes("flash") && !n.includes("pro")) return 1;
  if (n.includes("pro")) return 3;
  return 2;
}

async function listGenerateContentModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const names = (json.models ?? [])
      .filter((m) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent")
      )
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((n) => n && !n.includes("embed") && !n.includes("imagen"));
    names.sort(
      (a, b) => rankModelName(a) - rankModelName(b) || a.localeCompare(b)
    );
    return names;
  } catch {
    return [];
  }
}

async function getModelCandidates(apiKey: string): Promise<string[]> {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const listed = await listGenerateContentModels(apiKey);
  const base = listed.length ? listed : DEFAULT_MODELS;
  const list = preferred
    ? [preferred, ...base.filter((m) => m !== preferred)]
    : [...base];
  return [...new Set(list)].slice(0, 6);
}

type GeminiHttpResult =
  | { ok: true; text: string }
  | { ok: false; status: number; body: string };

async function callGemini(opts: {
  apiKey: string;
  model: string;
  mime: string;
  base64: string;
  prompt: string;
}): Promise<GeminiHttpResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: opts.prompt },
            {
              inline_data: {
                mime_type: opts.mime,
                data: opts.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  return { ok: true, text };
}

export { geminiConfigured };

function parseMoney(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return round2(raw);
  let s = String(raw ?? "")
    .trim()
    .replace(/€/g, "")
    .replace(/\s/g, "");
  if (!s) return 0;
  // EU: 1.234,56 o 452,50
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US / JSON: 1,234.56 o 452.50
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

function parsePeriodFromLabel(label: string): {
  year: number;
  month: number;
} | null {
  const m = /([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})/.exec(label);
  if (!m) return null;
  const month = MONTH_ES[m[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
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
      "No se pudo leer el mes/año del Informe IVA (ej. Abril 2026)"
    );
  }

  const grossSales = parseMoney(parsed.grossSales);
  const discounts = parseMoney(parsed.discounts);
  const returns = parseMoney(parsed.returns);
  let netSales = parseMoney(parsed.netSales);
  const shipping = parseMoney(parsed.shipping);
  const taxes = parseMoney(parsed.taxes);
  let totalSales = parseMoney(parsed.totalSales);

  if (!netSales && (grossSales || discounts || returns)) {
    netSales = round2(grossSales + discounts + returns);
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

  const mime = file.mimeType.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Formato no soportado. Usa PDF, JPG, PNG o WebP");
  }
  if (file.buffer.byteLength > MAX_BYTES) {
    throw new Error("El archivo supera 12 MB");
  }

  const prompt = `Eres un asistente fiscal. Extrae los datos de este INFORME IVA / resumen de ventas de Shopify (captura de pantalla o PDF).

NO es una factura unitaria ni un CSV por país: es un resumen mensual tipo «Informe IVA — Abril 2026» con conceptos:
Ventas brutas, Descuentos, Devoluciones, Ventas netas, Gastos de envío, IVA recaudado, Total ventas.

Devuelve SOLO un JSON válido:
{
  "periodYear": 2026,
  "periodMonth": 4,
  "periodLabel": "Informe IVA — Abril 2026",
  "grossSales": 452.50,
  "discounts": -79.96,
  "returns": 0,
  "netSales": 372.54,
  "shipping": 55.27,
  "taxes": 89.83,
  "totalSales": 517.64,
  "confidence": "high" | "medium" | "low"
}

Reglas:
- Importes en euros con punto decimal (452,50 → 452.50). Descuentos suelen ser negativos.
- periodMonth: 1–12. Si el título dice «Abril 2026», periodYear=2026, periodMonth=4.
- netSales = Ventas netas. shipping = Gastos de envío. taxes = IVA recaudado.
- totalSales = Total ventas.
- Si falta un concepto, 0. No inventes cifras.
- Archivo: ${file.fileName}`;

  const base64 = file.buffer.toString("base64");
  const models = await getModelCandidates(apiKey);
  let last429 = false;
  let last404 = false;
  let lastError = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(1500 * attempt);
      const result = await callGemini({
        apiKey,
        model,
        mime,
        base64,
        prompt,
      });

      if (result.ok) {
        return parseDraftFromText(result.text);
      }

      lastError = result.body.slice(0, 200);
      if (result.status === 429) {
        last429 = true;
        continue;
      }
      if (result.status === 404) {
        last404 = true;
        break;
      }
      if (result.status === 400 || result.status === 403) {
        throw new Error(
          `Gemini rechazó la petición (${result.status})${lastError ? `: ${lastError}` : "."}`
        );
      }
      throw new Error(
        `Error Gemini ${result.status}${lastError ? `: ${lastError}` : ""}`
      );
    }
  }

  if (last429) {
    throw new Error(
      "Límite de Gemini agotado. Espera un minuto o activa facturación en Google AI Studio."
    );
  }
  if (last404) {
    throw new Error(
      "Ningún modelo Gemini disponible. Define GEMINI_MODEL en el entorno."
    );
  }
  throw new Error(
    `No se pudo usar Gemini${lastError ? `: ${lastError}` : "."}`
  );
}
