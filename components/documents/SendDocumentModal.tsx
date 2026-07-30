"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getSendDocumentDraft,
  sendDocumentEmail,
  type SendDocDraft,
  type SendDocKind,
} from "@/app/(app)/documents/send-actions";

type Props = {
  kind: SendDocKind;
  id: string;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
};

export function SendDocumentModal({ kind, id, open, onClose, onSent }: Props) {
  const [draft, setDraft] = useState<SendDocDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachPdf, setAttachPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    setDraft(null);
    setLoadError(null);
    startTransition(() => {
      void getSendDocumentDraft(kind, id).then((res) => {
        if ("error" in res) {
          setLoadError(res.error);
          return;
        }
        setDraft(res);
        setTo(res.to);
        setSubject(res.subject);
        setBody(res.body);
        setAttachPdf(true);
      });
    });
  }, [open, kind, id]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(() => {
      void sendDocumentEmail(kind, id, { to, subject, body, attachPdf }).then(
        (res) => {
          if ("error" in res) {
            setError(res.error);
            return;
          }
          setSuccess(true);
          onSent?.();
          setTimeout(() => onClose(), 900);
        }
      );
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-doc-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="card-panel w-full max-w-lg space-y-4 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="send-doc-title"
              className="text-lg font-semibold tracking-tight"
            >
              Enviar {draft?.docLabel ?? (kind === "quote" ? "presupuesto" : "factura")}
            </h2>
            {draft ? (
              <p className="mt-0.5 font-mono text-sm text-ink-muted">
                {draft.fullNumber}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-sm"
            onClick={onClose}
            disabled={pending}
          >
            Cerrar
          </button>
        </div>

        {loadError ? (
          <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {loadError}
          </p>
        ) : !draft ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {!draft.configured ? (
              <p className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
                SMTP no configurado. {draft.configHint}
              </p>
            ) : null}

            <div>
              <label className="label" htmlFor="send-to">
                Para
              </label>
              <input
                id="send-to"
                type="email"
                required
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="send-subject">
                Asunto
              </label>
              <input
                id="send-subject"
                className="input"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="send-body">
                Mensaje
              </label>
              <textarea
                id="send-body"
                className="input min-h-[140px]"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={attachPdf}
                onChange={(e) => setAttachPdf(e.target.checked)}
              />
              Adjuntar PDF ({draft.attachName})
            </label>

            {error ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
                Correo enviado
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={pending || !draft.configured}
              >
                {pending ? "Enviando…" : "Enviar correo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
