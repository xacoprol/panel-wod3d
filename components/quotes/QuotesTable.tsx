"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  convertQuoteToInvoice,
  deleteQuote,
  duplicateQuote,
  setQuoteStatus,
} from "@/app/(app)/quotes/actions";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { SendDocumentModal } from "@/components/documents/SendDocumentModal";

export type QuoteListRow = {
  id: string;
  fullNumber: string;
  issueDate: string;
  validUntil: string | null;
  status: string;
  notes: string | null;
  discountPct: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  primaryVatRate: number | null;
  clientName: string;
  clientNif: string;
  invoiceId: string | null;
};

type ColumnId =
  | "cliente"
  | "fecha"
  | "total"
  | "numero"
  | "estado"
  | "nif"
  | "fCreacion"
  | "ultimaModif"
  | "validoHasta"
  | "baseImponible"
  | "cuotaIva"
  | "pctIva"
  | "descuento"
  | "observaciones";

type ColumnDef = {
  id: ColumnId;
  label: string;
  locked?: boolean;
  align?: "left" | "right";
};

const COLUMNS: ColumnDef[] = [
  { id: "cliente", label: "Cliente", locked: true },
  { id: "fecha", label: "Fecha", locked: true },
  { id: "total", label: "Total", locked: true, align: "right" },
  { id: "numero", label: "Número" },
  { id: "estado", label: "Estado" },
  { id: "nif", label: "NIF / CIF" },
  { id: "fCreacion", label: "F. creación" },
  { id: "ultimaModif", label: "Última modif." },
  { id: "validoHasta", label: "Válido hasta" },
  { id: "baseImponible", label: "Base imponible", align: "right" },
  { id: "cuotaIva", label: "Cuota IVA", align: "right" },
  { id: "pctIva", label: "% IVA", align: "right" },
  { id: "descuento", label: "Dto. general %", align: "right" },
  { id: "observaciones", label: "Observaciones" },
];

const DEFAULT_VISIBLE: ColumnId[] = [
  "cliente",
  "fecha",
  "numero",
  "estado",
  "total",
];

const STORAGE_KEY = "quotes-list-columns-v1";

function loadVisible(): ColumnId[] {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBLE;
    const parsed = JSON.parse(raw) as ColumnId[];
    const locked = COLUMNS.filter((c) => c.locked).map((c) => c.id);
    const allowed = new Set(COLUMNS.map((c) => c.id));
    const next = [
      ...locked,
      ...parsed.filter((id) => allowed.has(id) && !locked.includes(id)),
    ];
    return next.length ? next : DEFAULT_VISIBLE;
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function cellValue(q: QuoteListRow, id: ColumnId): ReactNode {
  switch (id) {
    case "cliente":
      return q.clientName;
    case "fecha":
      return formatDate(q.issueDate);
    case "total":
      return formatCurrency(q.total);
    case "numero":
      return <span className="font-mono">{q.fullNumber}</span>;
    case "estado":
      return <StatusBadge status={q.status} />;
    case "nif":
      return <span className="font-mono text-xs">{q.clientNif}</span>;
    case "fCreacion":
      return formatDate(q.createdAt);
    case "ultimaModif":
      return formatDate(q.updatedAt);
    case "validoHasta":
      return formatDate(q.validUntil);
    case "baseImponible":
      return formatCurrency(q.subtotal);
    case "cuotaIva":
      return formatCurrency(q.vatAmount);
    case "pctIva":
      return q.primaryVatRate != null ? `${q.primaryVatRate}%` : "—";
    case "descuento":
      return q.discountPct ? `${q.discountPct}%` : "—";
    case "observaciones":
      return (
        <span className="line-clamp-2 max-w-[14rem] text-ink-muted">
          {q.notes || "—"}
        </span>
      );
    default:
      return null;
  }
}

export function QuotesTable({ quotes }: { quotes: QuoteListRow[] }) {
  const router = useRouter();
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colsOpen, setColsOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const colsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(loadVisible());
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (colsRef.current && !colsRef.current.contains(t)) setColsOpen(false);
      if (menuRef.current && !menuRef.current.contains(t)) setMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function toggleColumn(id: ColumnId) {
    const def = COLUMNS.find((c) => c.id === id);
    if (!def || def.locked) return;
    setVisible((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const activeCols = useMemo(
    () => COLUMNS.filter((c) => visible.includes(c.id)),
    [visible]
  );

  function run(action: () => Promise<unknown>) {
    startTransition(() => {
      void action()
        .then(() => router.refresh())
        .catch((err) => {
          if (isRedirectError(err)) return;
          alert(err instanceof Error ? err.message : String(err));
        });
    });
  }

  return (
    <div className="card-panel overflow-visible">
      <SendDocumentModal
        kind="quote"
        id={sendId ?? ""}
        open={Boolean(sendId)}
        onClose={() => setSendId(null)}
        onSent={() => router.refresh()}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              {activeCols.map((c) => (
                <th
                  key={c.id}
                  className={`px-4 py-3 font-medium ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.label}
                </th>
              ))}
              <th className="relative w-40 px-4 py-3 text-right font-medium">
                Acciones
                <div className="relative ml-2 inline-block" ref={colsRef}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-line bg-bg-elevated px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-ink-muted hover:bg-line/40"
                    onClick={() => setColsOpen((o) => !o)}
                    aria-label="Columnas visibles"
                    title="Columnas"
                  >
                    ⚙
                    <span aria-hidden>▾</span>
                  </button>
                  {colsOpen ? (
                    <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-line bg-bg-elevated p-3 text-left shadow-lg normal-case tracking-normal">
                      <p className="mb-2 text-xs font-medium text-ink">
                        Selecciona las columnas que deseas ver en el listado:
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-ink">
                        {COLUMNS.map((c) => (
                          <label
                            key={c.id}
                            className={`flex items-center gap-2 ${
                              c.locked ? "opacity-60" : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={visible.includes(c.id)}
                              disabled={c.locked}
                              onChange={() => toggleColumn(c.id)}
                            />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td
                  colSpan={activeCols.length + 1}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  No hay presupuestos.{" "}
                  <Link href="/quotes/new" className="text-accent underline">
                    Crear uno
                  </Link>
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr
                  key={q.id}
                  className="cursor-pointer border-b border-line/60 hover:bg-accent-soft/40"
                  onClick={() => router.push(`/quotes/${q.id}`)}
                >
                  {activeCols.map((c) => (
                    <td
                      key={c.id}
                      className={`px-4 py-3 ${
                        c.align === "right" ? "text-right font-mono" : ""
                      } ${
                        c.id === "fecha" || c.id === "fCreacion" || c.id === "ultimaModif"
                          ? "text-ink-muted"
                          : ""
                      }`}
                    >
                      {cellValue(q, c.id)}
                    </td>
                  ))}
                  <td
                    className="relative px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1">
                      {!q.invoiceId ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={() => setSendId(q.id)}
                        >
                          Enviar
                        </button>
                      ) : null}
                      <div
                        className="relative"
                        ref={menuId === q.id ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-base leading-none"
                          aria-label="Más acciones"
                          onClick={() =>
                            setMenuId((id) => (id === q.id ? null : q.id))
                          }
                        >
                          ···
                        </button>
                        {menuId === q.id ? (
                          <div className="absolute right-0 z-30 mt-1 w-48 rounded-md border border-line bg-bg-elevated py-1 text-left shadow-lg">
                            {!q.invoiceId ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
                                disabled={pending}
                                onClick={() => {
                                  setMenuId(null);
                                  setSendId(q.id);
                                }}
                              >
                                Enviar
                              </button>
                            ) : null}
                            {!q.invoiceId ? (
                              <Link
                                href={`/quotes/${q.id}/edit`}
                                className="block px-3 py-1.5 text-sm hover:bg-accent-soft"
                                onClick={() => setMenuId(null)}
                              >
                                Modificar
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
                              disabled={pending}
                              onClick={() => {
                                setMenuId(null);
                                run(() => duplicateQuote(q.id));
                              }}
                            >
                              Duplicar
                            </button>
                            {!q.invoiceId ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm text-danger hover:bg-danger/10"
                                disabled={pending}
                                onClick={() => {
                                  setMenuId(null);
                                  if (
                                    confirm(
                                      `¿Eliminar el presupuesto ${q.fullNumber}?`
                                    )
                                  ) {
                                    run(() => deleteQuote(q.id));
                                  }
                                }}
                              >
                                Eliminar
                              </button>
                            ) : null}
                            {!q.invoiceId ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
                                disabled={pending}
                                onClick={() => {
                                  setMenuId(null);
                                  run(() => convertQuoteToInvoice(q.id));
                                }}
                              >
                                Convertir a factura
                              </button>
                            ) : (
                              <Link
                                href={`/invoices/${q.invoiceId}`}
                                className="block px-3 py-1.5 text-sm hover:bg-accent-soft"
                                onClick={() => setMenuId(null)}
                              >
                                Ver factura
                              </Link>
                            )}
                            <div className="my-1 border-t border-line" />
                            {!q.invoiceId ? (
                              <>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
                                  disabled={pending}
                                  onClick={() => {
                                    setMenuId(null);
                                    run(() => setQuoteStatus(q.id, "ACEPTADO"));
                                  }}
                                >
                                  Aceptado
                                </button>
                                <button
                                  type="button"
                                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
                                  disabled={pending}
                                  onClick={() => {
                                    setMenuId(null);
                                    run(() =>
                                      setQuoteStatus(q.id, "RECHAZADO")
                                    );
                                  }}
                                >
                                  Rechazado
                                </button>
                              </>
                            ) : null}
                            <a
                              href={`/api/quotes/${q.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="block px-3 py-1.5 text-sm hover:bg-accent-soft"
                              onClick={() => setMenuId(null)}
                            >
                              Imprimir
                            </a>
                            <a
                              href={`/api/quotes/${q.id}/pdf?download=1`}
                              className="block px-3 py-1.5 text-sm hover:bg-accent-soft"
                              onClick={() => setMenuId(null)}
                            >
                              Descargar
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
