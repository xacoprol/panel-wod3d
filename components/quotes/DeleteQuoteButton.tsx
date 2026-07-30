"use client";

import { useState, useTransition } from "react";
import { deleteQuote } from "@/app/(app)/quotes/actions";
import { isRedirectError } from "next/dist/client/components/redirect-error";

type ModalProps = {
  quoteId: string;
  fullNumber: string;
  kindLabel?: string;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
};

export function DeleteQuoteConfirmModal({
  quoteId,
  fullNumber,
  kindLabel = "presupuesto",
  open,
  onClose,
  onDeleted,
}: ModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function handleConfirm() {
    setError(null);
    startTransition(() => {
      void deleteQuote(quoteId)
        .then(() => {
          onClose();
          onDeleted?.();
        })
        .catch((err) => {
          if (isRedirectError(err)) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-quote-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="card-panel w-full max-w-md space-y-4 p-5 shadow-xl">
        <div>
          <h2
            id="delete-quote-title"
            className="text-lg font-semibold tracking-tight"
          >
            Eliminar {kindLabel}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            ¿Seguro que quieres eliminar{" "}
            <span className="font-mono font-medium text-ink">{fullNumber}</span>?
            Esta acción no se puede deshacer.
          </p>
        </div>

        {error ? (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ButtonProps = {
  quoteId: string;
  fullNumber: string;
  kindLabel?: string;
};

export function DeleteQuoteButton({
  quoteId,
  fullNumber,
  kindLabel = "presupuesto",
}: ButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-danger px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
        onClick={() => setOpen(true)}
      >
        Eliminar
      </button>
      <DeleteQuoteConfirmModal
        quoteId={quoteId}
        fullNumber={fullNumber}
        kindLabel={kindLabel}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
