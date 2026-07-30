import { EXPENSE_CATEGORIES } from "@/lib/fiscal";

export type ParsedExpenseDraft = {
  issueDate: string; // YYYY-MM-DD
  supplierName: string;
  supplierNif: string | null;
  description: string | null;
  category: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Modelos actuales (2.0 y 1.5 ya retirados). Orden: barato/rápido primero.
 * Si fallan, se consulta ListModels en la API.
 */
const DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
];

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
    names.sort((a, b) => rankModelName(a) - rankModelName(b) || a.localeCompare(b));
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
  // Cap to avoid hammering on 429 across dozens of models
  return [...new Set(list)].slice(0, 6);
}

function categoryIds(): string[] {
  return EXPENSE_CATEGORIES.map((c) => c.id);
}

function normalizeCategory(raw: unknown): string {
  const s = String(raw ?? "OTROS").toUpperCase().trim();
  return categoryIds().includes(s) ? s : "OTROS";
}

function normalizeVatRate(raw: unknown): number {
  const n = Number(raw);
  if (![0, 4, 10, 21].includes(n)) {
    if (!Number.isFinite(n) || n <= 0) return 21;
    if (n < 2) return 0;
    if (n < 7) return 4;
    if (n < 15.5) return 10;
    return 21;
  }
  return n;
}

function normalizeDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function geminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
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

function parseDraftFromText(text: string): ParsedExpenseDraft {
  if (!text.trim()) {
    throw new Error("Gemini no devolvió datos. Prueba con otra imagen/PDF.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No se pudo interpretar la respuesta de Gemini");
    parsed = JSON.parse(m[0]) as Record<string, unknown>;
  }

  const subtotal = round2(Math.max(0, Number(parsed.subtotal) || 0));
  const vatRate = normalizeVatRate(parsed.vatRate);
  let vatAmount = round2(Math.max(0, Number(parsed.vatAmount) || 0));
  let total = round2(Math.max(0, Number(parsed.total) || 0));

  if (!vatAmount && subtotal && vatRate) {
    vatAmount = round2(subtotal * (vatRate / 100));
  }
  if (!total) {
    total = round2(subtotal + vatAmount);
  }

  const confidenceRaw = String(parsed.confidence ?? "medium").toLowerCase();
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  const supplierName = String(parsed.supplierName ?? "").trim();
  if (!supplierName) {
    throw new Error(
      "No se pudo leer el proveedor. Revisa el archivo o rellena a mano."
    );
  }

  return {
    issueDate: normalizeDate(parsed.issueDate),
    supplierName,
    supplierNif: String(parsed.supplierNif ?? "").trim() || null,
    description: String(parsed.description ?? "").trim() || null,
    category: normalizeCategory(parsed.category),
    subtotal,
    vatRate,
    vatAmount,
    total,
    notes: String(parsed.notes ?? "").trim() || null,
    confidence,
  };
}

export async function parseExpenseDocument(file: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ParsedExpenseDraft> {
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
    throw new Error("El archivo supera 8 MB");
  }

  const categories = categoryIds().join(", ");
  const prompt = `Eres un asistente fiscal español. Extrae los datos de esta factura o ticket de GASTO (factura recibida / compra).
Devuelve SOLO un JSON válido con esta forma exacta:
{
  "issueDate": "YYYY-MM-DD",
  "supplierName": "nombre del emisor/proveedor",
  "supplierNif": "NIF/CIF del proveedor o null",
  "description": "concepto breve en español o null",
  "category": "una de: ${categories}",
  "subtotal": 0,
  "vatRate": 21,
  "vatAmount": 0,
  "total": 0,
  "notes": "cualquier duda o dato ambiguo, o null",
  "confidence": "high" | "medium" | "low"
}

Reglas:
- Importes en euros (número, no string). Usa punto decimal.
- subtotal = base imponible (sin IVA). vatAmount = cuota IVA. total = a pagar.
- Si hay varios tipos de IVA, usa el predominante o el del total; anótalo en notes.
- Si no hay IVA (exento), vatRate=0, vatAmount=0, total=subtotal.
- No inventes NIF: si no se lee claramente, null.
- La fecha es la de la factura/ticket, no la de hoy.
- category: elige la más razonable para un autónomo (SOFTWARE, SUMINISTROS, MATERIAL, DIETAS, PROFESIONALES, OTROS).`;

  const base64 = file.buffer.toString("base64");
  const models = await getModelCandidates(apiKey);
  let last429 = false;
  let last404 = false;
  let lastError = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await sleep(1500 * attempt);
      }
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
          `Gemini rechazó la petición (${result.status}). Revisa la API key y el modelo${lastError ? `: ${lastError}` : "."}`
        );
      }
      throw new Error(
        `Error Gemini ${result.status}${lastError ? `: ${lastError}` : ""}`
      );
    }
  }

  if (last429) {
    throw new Error(
      "Límite gratis de Gemini agotado (pocas peticiones/minuto). Espera 1 minuto o activa facturación en Google AI Studio (pay-as-you-go, suele costar céntimos)."
    );
  }
  if (last404) {
    throw new Error(
      "Ningún modelo Gemini disponible con esta API key. En Vercel define GEMINI_MODEL (ej. gemini-2.5-flash-lite) o revisa la clave."
    );
  }
  throw new Error(
    `No se pudo usar Gemini${lastError ? `: ${lastError}` : "."}`
  );
}
