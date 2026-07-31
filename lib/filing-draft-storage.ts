import type { ParsedFiscalFilingDraft } from "@/lib/gemini-fiscal-filing";

export const FILING_DRAFT_QUEUE_KEY = "fiscal-filing-draft-queue-v1";

export type FilingQueueItem = ParsedFiscalFilingDraft & {
  localId: string;
  fileName: string;
};

export function saveFilingDraftQueue(items: FilingQueueItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(FILING_DRAFT_QUEUE_KEY, JSON.stringify(items));
}

export function peekFilingDraftQueue(): FilingQueueItem[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(FILING_DRAFT_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FilingQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearFilingDraftQueue() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(FILING_DRAFT_QUEUE_KEY);
}
