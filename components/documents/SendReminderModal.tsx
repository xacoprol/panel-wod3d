"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getReminderDraft,
  sendPaymentReminder,
} from "@/app/(app)/documents/reminder-actions";
import type { SendDocDraft } from "@/app/(app)/documents/send-actions";

type Props = {
  invoiceId: string;
  open: boolean;
  onClose: () => void;
};

export function SendReminderModal({ invoiceId, open, onClose }: Props) {
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
      void getReminderDraft(invoiceId).then((res) => {
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
  }, [open, invoiceId]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(() => {
      void sendPaymentReminder(invoiceId, {
        to,
        subject,
        body,
        attachPdf,
      }).then((res) => {
        if ("error" in res) {
          setError(res.error);
          return;
        }
        setSuccess(true);
        setTimeout(() => onClose(), 900);
      });
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div className="card-panel w-full max-w-lg space-y-4 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Enviar recordatorio de cobro
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
              <label className="label" htmlFor="reminder-to">
                Para
              </label>
              <input
                id="reminder-to"
                type="email"
                required
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="reminder-subject">
                Asunto
              </label>
              <input
                id="reminder-subject"
                required
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="reminder-body">
                Mensaje
              </label>
              <textarea
                id="reminder-body"
                required
                rows={6}
                className="input"
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
              Adjuntar PDF
            </label>
            {error ? (
              <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
                Recordatorio enviado
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-ghost"
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
                {pending ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
