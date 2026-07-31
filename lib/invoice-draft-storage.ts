import type { ParsedInvoiceDraft } from "@/lib/gemini-invoice";

export const INVOICE_DRAFT_QUEUE_KEY = "invoice-historical-draft-queue-v1";

export type InvoiceQueueItem = ParsedInvoiceDraft & {
  localId: string;
  fileName: string;
};

export function saveInvoiceDraftQueue(items: InvoiceQueueItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INVOICE_DRAFT_QUEUE_KEY, JSON.stringify(items));
}

export function peekInvoiceDraftQueue(): InvoiceQueueItem[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(INVOICE_DRAFT_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as InvoiceQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearInvoiceDraftQueue() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVOICE_DRAFT_QUEUE_KEY);
}
