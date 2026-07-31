/**
 * OCR de facturas emitidas (ingresos) históricas vía Gemini.
 */
import { geminiConfigured } from "@/lib/gemini-expense";

export type ParsedInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPct: number;
};

export type ParsedInvoiceDraft = {
  fullNumber: string | null;
  issueDate: string; // YYYY-MM-DD
  dueDate: string | null;
  clientName: string;
  clientNif: string | null;
  clientCountryCode: string | null;
  clientAddressStreet: string | null;
  clientAddressCity: string | null;
  clientAddressProvince: string | null;
  clientAddressZip: string | null;
  clientAddressCountry: string | null;
  clientEmail: string | null;
  description: string | null;
  lines: ParsedInvoiceLine[];
  subtotal: number;
  vatAmount: number;
  irpfRate: number;
  irpfAmount: number;
  total: number;
  vatOperationType: string;
  paymentMethod: string | null;
  notes: string | null;
  /** Si el documento indica pagada / cobrada */
  likelyPaid: boolean;
  confidence: "high" | "medium" | "low";
};

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

function normalizeDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeOptionalDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  return normalizeDate(raw);
}

function normalizeVatOp(raw: unknown): string {
  const s = String(raw ?? "SUJETA").toUpperCase().trim();
  if (
    ["SUJETA", "EXENTA", "INTRACOMUNITARIA", "CANARIAS", "EXPORTACION"].includes(
      s
    )
  ) {
    return s;
  }
  if (s.includes("EXENT")) return "EXENTA";
  if (s.includes("INTRA")) return "INTRACOMUNITARIA";
  if (s.includes("CANAR")) return "CANARIAS";
  if (s.includes("EXPORT")) return "EXPORTACION";
  return "SUJETA";
}

function parseLines(raw: unknown): ParsedInvoiceLine[] {
  if (!Array.isArray(raw) || !raw.length) return [];
  return raw
    .map((row) => {
      const o = row as Record<string, unknown>;
      return {
        description: String(o.description ?? "").trim() || "Concepto",
        quantity: Number(o.quantity) || 1,
        unitPrice: round2(Number(o.unitPrice) || 0),
        vatRate: Number(o.vatRate) || 0,
        discountPct: Number(o.discountPct) || 0,
      };
    })
    .filter((l) => l.description);
}

function parseDraftFromText(text: string): ParsedInvoiceDraft {
  if (!text.trim()) {
    throw new Error("Gemini no devolvió datos. Prueba con otro PDF/imagen.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No se pudo interpretar la respuesta de Gemini");
    parsed = JSON.parse(m[0]) as Record<string, unknown>;
  }

  const clientName = String(parsed.clientName ?? "").trim();
  if (!clientName) {
    throw new Error(
      "No se pudo leer el cliente. Revisa el archivo o rellena a mano."
    );
  }

  let lines = parseLines(parsed.lines);
  const subtotal = round2(Math.max(0, Number(parsed.subtotal) || 0));
  const vatAmount = round2(Math.max(0, Number(parsed.vatAmount) || 0));
  const irpfRate = Number(parsed.irpfRate) || 0;
  const irpfAmount = round2(Math.max(0, Number(parsed.irpfAmount) || 0));
  let total = round2(Math.max(0, Number(parsed.total) || 0));
  if (!total) total = round2(subtotal + vatAmount - irpfAmount);

  if (!lines.length && (subtotal > 0 || total > 0)) {
    const base = subtotal || round2(total - vatAmount + irpfAmount);
    const vatRate =
      base > 0 && vatAmount > 0
        ? round2((vatAmount / base) * 100)
        : vatAmount === 0
          ? 0
          : 21;
    lines = [
      {
        description:
          String(parsed.description ?? "").trim() || "Servicios / productos",
        quantity: 1,
        unitPrice: base,
        vatRate: [0, 4, 10, 21].includes(vatRate)
          ? vatRate
          : vatRate < 2
            ? 0
            : vatRate < 7
              ? 4
              : vatRate < 15.5
                ? 10
                : 21,
        discountPct: 0,
      },
    ];
  }

  const confidenceRaw = String(parsed.confidence ?? "medium").toLowerCase();
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "low"
      ? confidenceRaw
      : "medium";

  return {
    fullNumber: String(parsed.fullNumber ?? "").trim() || null,
    issueDate: normalizeDate(parsed.issueDate),
    dueDate: normalizeOptionalDate(parsed.dueDate),
    clientName,
    clientNif: String(parsed.clientNif ?? "").trim() || null,
    clientCountryCode:
      String(parsed.clientCountryCode ?? "").trim().toUpperCase() || null,
    clientAddressStreet:
      String(parsed.clientAddressStreet ?? "").trim() || null,
    clientAddressCity: String(parsed.clientAddressCity ?? "").trim() || null,
    clientAddressProvince:
      String(parsed.clientAddressProvince ?? "").trim() || null,
    clientAddressZip: String(parsed.clientAddressZip ?? "").trim() || null,
    clientAddressCountry:
      String(parsed.clientAddressCountry ?? "").trim() || null,
    clientEmail: String(parsed.clientEmail ?? "").trim() || null,
    description: String(parsed.description ?? "").trim() || null,
    lines,
    subtotal,
    vatAmount,
    irpfRate,
    irpfAmount,
    total,
    vatOperationType: normalizeVatOp(parsed.vatOperationType),
    paymentMethod: String(parsed.paymentMethod ?? "").trim() || null,
    notes: String(parsed.notes ?? "").trim() || null,
    likelyPaid: Boolean(parsed.likelyPaid),
    confidence,
  };
}

export async function parseIssuedInvoiceDocument(file: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ParsedInvoiceDraft> {
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

  const prompt = `Eres un asistente fiscal español. Extrae los datos de esta FACTURA EMITIDA (venta / ingreso del emisor WOD3D / Vexo), NO una factura de gasto recibida.

Devuelve SOLO un JSON válido:
{
  "fullNumber": "número completo de factura (ej. W3D260113, A-2025-001) o null",
  "issueDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD" o null,
  "clientName": "nombre del cliente / receptor",
  "clientNif": "NIF/CIF/NIE del cliente o null",
  "clientCountryCode": "ES" | "PT" | … o null,
  "clientAddressStreet": "calle o null",
  "clientAddressCity": "ciudad o null",
  "clientAddressProvince": "provincia o null",
  "clientAddressZip": "CP o null",
  "clientAddressCountry": "país o null",
  "clientEmail": "email o null",
  "description": "resumen breve o null",
  "lines": [
    {
      "description": "concepto",
      "quantity": 1,
      "unitPrice": 0,
      "vatRate": 21,
      "discountPct": 0
    }
  ],
  "subtotal": 0,
  "vatAmount": 0,
  "irpfRate": 0,
  "irpfAmount": 0,
  "total": 0,
  "vatOperationType": "SUJETA" | "EXENTA" | "INTRACOMUNITARIA" | "CANARIAS" | "EXPORTACION",
  "paymentMethod": "Transferencia" | null,
  "notes": "dudas o null",
  "likelyPaid": false,
  "confidence": "high" | "medium" | "low"
}

Reglas:
- El CLIENTE es el destinatario / receptor de la factura (no el emisor).
- fullNumber: el nº de factura tal cual aparece (W3D…, serie-año-número…). Conserva el formato.
- Importes en euros con punto decimal.
- Si no hay desglose de líneas, crea UNA línea con la base imponible.
- vatOperationType: EXENTA/INTRACOMUNITARIA/etc. si el documento lo indica; si no, SUJETA.
- likelyPaid: true solo si el documento indica claramente pagada/cobrada.
- No inventes NIF: si no se lee, null.
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
