"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { parseExpenseFromUpload } from "@/app/(app)/fiscal/expenses/parse-actions";
import type { ParsedExpenseDraft } from "@/lib/gemini-expense";
import {
  saveExpenseDraft,
  saveExpenseDraftQueue,
  type ExpenseQueueItem,
} from "@/lib/expense-draft-storage";

type Props = {
  /** Si se pasa y solo hay 1 archivo, rellena el formulario en la misma página. */
  onParsed?: (draft: ParsedExpenseDraft) => void;
  compact?: boolean;
};

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif";
const MAX_FILES = 20;

function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ExpenseDropZone({ onParsed, compact }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);

  const parsing = progress != null;

  async function handleFiles(fileList: FileList | File[] | null) {
    setError(null);
    const files = Array.from(fileList ?? []).filter((f) => f.size > 0);
    if (!files.length) return;
    if (files.length > MAX_FILES) {
      setError(`Máximo ${MAX_FILES} archivos a la vez`);
      return;
    }

    const ok: ExpenseQueueItem[] = [];
    const failures: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({
        current: i + 1,
        total: files.length,
        fileName: file.name,
      });

      const fd = new FormData();
      fd.set("file", file);
      const res = await parseExpenseFromUpload(fd);
      if (!res.ok) {
        failures.push(`${file.name}: ${res.error}`);
        continue;
      }
      ok.push({
        ...res.draft,
        localId: newLocalId(),
        fileName: file.name,
      });

      // Pausa breve entre lecturas para no saturar el free tier de Gemini
      if (i < files.length - 1) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setProgress(null);

    if (!ok.length) {
      setError(
        failures[0] ?? "No se pudo leer ninguna factura. Prueba de nuevo."
      );
      return;
    }

    if (failures.length) {
      setError(
        `Se leyeron ${ok.length} de ${files.length}. Fallaron: ${failures.join(" · ")}`
      );
    }

    if (ok.length === 1 && onParsed) {
      onParsed(ok[0]);
      return;
    }

    if (ok.length === 1) {
      saveExpenseDraft(ok[0]);
      router.push("/fiscal/expenses/new");
      return;
    }

    saveExpenseDraftQueue(ok);
    router.push("/fiscal/expenses/batch");
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
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
        onClick={() => {
          if (!parsing) inputRef.current?.click();
        }}
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
          multiple
          className="sr-only"
          disabled={parsing}
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium text-ink">
          {parsing
            ? `Leyendo ${progress.current}/${progress.total}…`
            : dragging
              ? "Suelta aquí las facturas"
              : "Arrastra aquí una o varias facturas de gasto"}
        </p>
        {parsing ? (
          <p className="mt-1 truncate text-xs text-ink-muted">
            {progress.fileName}
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            PDF, JPG o PNG · hasta {MAX_FILES} · Gemini rellena · tú revisas y
            guardas
          </p>
        )}
        {!parsing ? (
          <p className="mt-3 text-xs font-medium text-accent">
            o haz clic para elegir archivos
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
