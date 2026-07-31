"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { parseInvoiceFromUpload } from "@/app/(app)/invoices/parse-actions";
import {
  saveInvoiceDraftQueue,
  type InvoiceQueueItem,
} from "@/lib/invoice-draft-storage";
import { Spinner } from "@/components/ui/Spinner";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif";
const MAX_FILES = 20;
/** Si el server action no responde (proxy/Vercel), desbloquear la UI. */
const CLIENT_TIMEOUT_MS = 90_000;

function newLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Tiempo de espera agotado al leer la factura. Prueba de nuevo o sube PNG/JPG."
              )
            ),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Props = {
  compact?: boolean;
};

export function InvoiceDropZone({ compact }: Props) {
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

    const ok: InvoiceQueueItem[] = [];
    const failures: string[] = [];

    setProgress({
      current: 1,
      total: files.length,
      fileName: files[0].name,
    });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({
          current: i + 1,
          total: files.length,
          fileName: file.name,
        });

        const fd = new FormData();
        fd.set("file", file);
        let res: Awaited<ReturnType<typeof parseInvoiceFromUpload>>;
        try {
          res = await withTimeout(parseInvoiceFromUpload(fd), CLIENT_TIMEOUT_MS);
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : "Error al leer"}`
          );
          continue;
        }
        if (!res.ok) {
          failures.push(`${file.name}: ${res.error}`);
          continue;
        }
        ok.push({
          ...res.draft,
          localId: newLocalId(),
          fileName: file.name,
        });

        if (i < files.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

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

      saveInvoiceDraftQueue(ok);
      router.push("/invoices/import");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo procesar la subida"
      );
    } finally {
      setProgress(null);
    }
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
          {parsing ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              {progress
                ? `Leyendo ${progress.current}/${progress.total}…`
                : "Leyendo…"}
            </span>
          ) : dragging
            ? "Suelta aquí las facturas emitidas"
            : "Arrastra facturas de ingreso históricas (PDF/imagen)"}
        </p>
        {parsing ? (
          <p className="mt-1 truncate text-xs text-ink-muted">
            {progress.fileName}
          </p>
        ) : (
          <p className="mt-1 text-xs text-ink-muted">
            Conserva el nº original · Gemini lee · tú revisas · hasta{" "}
            {MAX_FILES} archivos
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
