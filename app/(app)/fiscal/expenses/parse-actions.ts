"use server";

import { requireAuth } from "@/lib/session";
import {
  geminiConfigured,
  parseExpenseDocument,
  type ParsedExpenseDraft,
} from "@/lib/gemini-expense";

export type ParseExpenseResult =
  | { ok: true; draft: ParsedExpenseDraft }
  | { ok: false; error: string };

export async function parseExpenseFromUpload(
  formData: FormData
): Promise<ParseExpenseResult> {
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
    const draft = await parseExpenseDocument({
      buffer,
      mimeType: file.type || "application/octet-stream",
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
