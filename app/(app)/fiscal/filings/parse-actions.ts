"use server";

import { requireAuth } from "@/lib/session";
import {
  geminiConfigured,
  parseFiscalFilingDocument,
  type ParsedFiscalFilingDraft,
} from "@/lib/gemini-fiscal-filing";

export type ParseFilingResult =
  | { ok: true; draft: ParsedFiscalFilingDraft }
  | { ok: false; error: string };

export async function parseFiscalFilingFromUpload(
  formData: FormData
): Promise<ParseFilingResult> {
  await requireAuth();

  if (!geminiConfigured()) {
    return {
      ok: false,
      error:
        "Falta la variable GEMINI_API_KEY en el entorno (Vercel / .env local).",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Selecciona un PDF o imagen del modelo" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await parseFiscalFilingDocument({
      buffer,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
    });
    return { ok: true, draft };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo leer el documento",
    };
  }
}
