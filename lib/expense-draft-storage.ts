import type { ParsedExpenseDraft } from "@/lib/gemini-expense";

export const EXPENSE_DRAFT_KEY = "fiscal-expense-draft-v1";

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
