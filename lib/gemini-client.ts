/**
 * Cliente compartido Gemini (generateContent) con timeout y lista corta de modelos.
 * Evita colgar la UI listando decenas de modelos o reintentando sin límite.
 */

export const GEMINI_DEFAULT_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-3.5-flash-lite",
] as const;

/** Por petición; en Vercel Hobby el techo real ~10s, en Pro más. */
const FETCH_TIMEOUT_MS = 35_000;

export function getGeminiApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    null
  );
}

export function geminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function resolveUploadMime(
  mimeType: string | null | undefined,
  fileName: string
): string {
  const t = String(mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (t && t !== "application/octet-stream" && t !== "binary/octet-stream") {
    return t;
  }
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return t || "application/octet-stream";
}

/** Modelos a probar: GEMINI_MODEL primero, luego lista corta (sin listar la API). */
export function getGeminiModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  const base = [...GEMINI_DEFAULT_MODELS];
  const list = preferred
    ? [preferred, ...base.filter((m) => m !== preferred)]
    : base;
  return [...new Set(list)].slice(0, 4);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type GeminiHttpResult =
  | { ok: true; text: string }
  | { ok: false; status: number; body: string; timedOut?: boolean };

export async function callGeminiGenerateJson(opts: {
  apiKey: string;
  model: string;
  mime: string;
  base64: string;
  prompt: string;
  timeoutMs?: number;
}): Promise<GeminiHttpResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
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
  } catch (e) {
    const timedOut =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof e === "object" &&
        e != null &&
        "name" in e &&
        (e as { name: string }).name === "AbortError");
    if (timedOut) {
      return {
        ok: false,
        status: 408,
        body: "timeout",
        timedOut: true,
      };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Prueba unos pocos modelos; en 429 reintenta 1 vez; en timeout pasa al siguiente.
 */
export async function generateJsonWithFallback(opts: {
  apiKey: string;
  mime: string;
  base64: string;
  prompt: string;
}): Promise<string> {
  const models = getGeminiModelCandidates();
  let last429 = false;
  let lastTimeout = false;
  let lastError = "";

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(1200 * attempt);
      const result = await callGeminiGenerateJson({
        apiKey: opts.apiKey,
        model,
        mime: opts.mime,
        base64: opts.base64,
        prompt: opts.prompt,
      });

      if (result.ok) {
        if (!result.text.trim()) {
          lastError = "respuesta vacía";
          break; // siguiente modelo
        }
        return result.text;
      }

      lastError = result.body.slice(0, 200);
      if (result.timedOut) {
        lastTimeout = true;
        break; // siguiente modelo
      }
      if (result.status === 429) {
        last429 = true;
        continue;
      }
      if (result.status === 404) {
        break; // modelo inexistente → siguiente
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
  if (lastTimeout) {
    throw new Error(
      "Gemini tardó demasiado en leer el archivo. Prueba de nuevo o sube una imagen PNG/JPG."
    );
  }
  throw new Error(
    `No se pudo usar Gemini${lastError ? `: ${lastError}` : "."}`
  );
}
