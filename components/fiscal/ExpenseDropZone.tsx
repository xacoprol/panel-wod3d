"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { parseExpenseFromUpload } from "@/app/(app)/fiscal/expenses/parse-actions";
import type { ParsedExpenseDraft } from "@/lib/gemini-expense";
import { saveExpenseDraft } from "@/lib/expense-draft-storage";

type Props = {
  /** Si se pasa, rellena el formulario en la misma página. Si no, va a /fiscal/expenses/new. */
  onParsed?: (draft: ParsedExpenseDraft) => void;
  compact?: boolean;
};

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif";

export function ExpenseDropZone({ onParsed, compact }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, startParse] = useTransition();

  function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startParse(() => {
      void parseExpenseFromUpload(fd).then((res) => {
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (onParsed) {
          onParsed(res.draft);
          return;
        }
        saveExpenseDraft(res.draft);
        router.push("/fiscal/expenses/new");
      });
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    handleFile(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 text-center transition ${
          compact ? "py-6" : "py-10 sm:py-12"
        } ${
          dragging
            ? "border-accent bg-accent-soft/60"
            : "border-line bg-bg-elevated hover:border-accent/50 hover:bg-accent-soft/30"
        } ${parsing ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={parsing}
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium text-ink">
          {parsing
            ? "Leyendo factura…"
            : dragging
              ? "Suelta aquí la factura"
              : "Arrastra aquí la factura de gasto"}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          PDF, JPG o PNG · Gemini rellena los datos · tú revisas y guardas
        </p>
        {!parsing ? (
          <p className="mt-3 text-xs font-medium text-accent">
            o haz clic para elegir archivo
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
