"use server";

import { requireAuth } from "@/lib/session";
import {
  geminiConfigured,
  parseIssuedInvoiceDocument,
  type ParsedInvoiceDraft,
} from "@/lib/gemini-invoice";
import { resolveUploadMime } from "@/lib/gemini-client";

export type ParseInvoiceResult =
  | { ok: true; draft: ParsedInvoiceDraft }
  | { ok: false; error: string };

export async function parseInvoiceFromUpload(
  formData: FormData
): Promise<ParseInvoiceResult> {
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
    return { ok: false, error: "Selecciona un PDF o imagen de la factura" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await parseIssuedInvoiceDocument({
      buffer,
      mimeType: resolveUploadMime(file.type, file.name),
      fileName: file.name,
    });
    return { ok: true, draft };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo leer la factura",
    };
  }
}
