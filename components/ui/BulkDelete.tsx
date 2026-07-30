"use client";

import { useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

type Props = {
  count: number;
  entityLabel: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  description?: string;
};

export function BulkDeleteConfirmModal({
  count,
  entityLabel,
  open,
  onClose,
  onConfirm,
  description,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function handleConfirm() {
    setError(null);
    startTransition(() => {
      void onConfirm()
        .then(() => onClose())
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
      aria-labelledby="bulk-delete-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="card-panel w-full max-w-md space-y-4 p-5 shadow-xl">
        <div>
          <h2
            id="bulk-delete-title"
            className="text-lg font-semibold tracking-tight"
          >
            Eliminar {entityLabel}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            ¿Seguro que quieres eliminar{" "}
            <span className="font-medium text-ink">
              {count} {entityLabel}
            </span>
            ? Esta acción no se puede deshacer.
            {description ? ` ${description}` : null}
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

type BarProps = {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function BulkSelectionBar({
  count,
  onClear,
  onDelete,
  disabled,
}: BarProps) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-accent-soft/50 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-ink">
          {count} seleccionado{count === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="text-ink-muted underline-offset-2 hover:text-accent hover:underline"
          onClick={onClear}
        >
          Quitar selección
        </button>
      </div>
      <button
        type="button"
        className="btn-danger"
        disabled={disabled}
        onClick={onDelete}
      >
        Eliminar
      </button>
    </div>
  );
}
