"use server";

import { requireAuth } from "@/lib/session";
import {
  geminiConfigured,
  parseExpenseDocument,
  type ParsedExpenseDraft,
} from "@/lib/gemini-expense";
import {
  isAmazonFeesInvoice,
  parseAmazonFeesInvoiceCsv,
} from "@/lib/amazon-fees-invoice";
import { parseCsv } from "@/lib/amazon-tax-report";
import { resolveUploadMime } from "@/lib/gemini-client";

export type ParseExpenseResult =
  | {
      ok: true;
      draft: ParsedExpenseDraft;
      drafts: ParsedExpenseDraft[];
    }
  | { ok: false; error: string };

function isCsvUpload(file: File, mime: string): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".csv") ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "text/plain"
  );
}

export async function parseExpenseFromUpload(
  formData: FormData
): Promise<ParseExpenseResult> {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: "Selecciona un PDF, imagen o CSV de comisiones Amazon",
    };
  }

  const mime = resolveUploadMime(file.type, file.name);

  try {
    if (isCsvUpload(file, mime)) {
      const text = await file.text();
      const table = parseCsv(text.replace(/^\uFEFF/, ""));
      const headers =
        table[0]?.map((h) => h.trim().replace(/^"|"$/g, "")) ?? [];

      if (!isAmazonFeesInvoice(headers)) {
        return {
          ok: false,
          error:
            "CSV no reconocido. Usa el export de facturas de comisiones Amazon (Fees Invoice Number / Fee ID / Total Fees).",
        };
      }

      const drafts = parseAmazonFeesInvoiceCsv(text, file.name);
      return { ok: true, draft: drafts[0], drafts };
    }

    if (!geminiConfigured()) {
      return {
        ok: false,
        error:
          "Falta la variable GEMINI_API_KEY en el entorno (Vercel / .env local).",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const draft = await parseExpenseDocument({
      buffer,
      mimeType: mime,
      fileName: file.name,
    });
    return { ok: true, draft, drafts: [draft] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo leer la factura",
    };
  }
}
