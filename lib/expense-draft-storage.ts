import type { ParsedExpenseDraft } from "@/lib/gemini-expense";

export const EXPENSE_DRAFT_KEY = "fiscal-expense-draft-v1";
export const EXPENSE_DRAFT_QUEUE_KEY = "fiscal-expense-draft-queue-v1";

export type ExpenseQueueItem = ParsedExpenseDraft & {
  /** Id local de la cola (no es el id de BD). */
  localId: string;
  fileName: string;
};

export function saveExpenseDraft(draft: ParsedExpenseDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EXPENSE_DRAFT_KEY, JSON.stringify(draft));
}

export function consumeExpenseDraft(): ParsedExpenseDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(EXPENSE_DRAFT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(EXPENSE_DRAFT_KEY);
  try {
    return JSON.parse(raw) as ParsedExpenseDraft;
  } catch {
    return null;
  }
}

export function saveExpenseDraftQueue(items: ExpenseQueueItem[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EXPENSE_DRAFT_QUEUE_KEY, JSON.stringify(items));
}

export function peekExpenseDraftQueue(): ExpenseQueueItem[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(EXPENSE_DRAFT_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ExpenseQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function consumeExpenseDraftQueue(): ExpenseQueueItem[] {
  const items = peekExpenseDraftQueue();
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(EXPENSE_DRAFT_QUEUE_KEY);
  }
  return items;
}

export function clearExpenseDraftQueue() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(EXPENSE_DRAFT_QUEUE_KEY);
}
