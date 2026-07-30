"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  isProforma: boolean;
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
      return (
        <span className="inline-flex items-center gap-1.5 font-mono">
          {q.fullNumber}
          {q.isProforma ? (
            <span className="badge bg-accent-soft text-[10px] font-sans font-medium normal-case tracking-normal text-accent">
              Proforma
            </span>
          ) : null}
        </span>
      );
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

function QuoteActionsMenu({
  q,
  pending,
  onClose,
  run,
  onSend,
  itemClassName,
}: {
  q: QuoteListRow;
  pending: boolean;
  onClose: () => void;
  run: (action: () => Promise<unknown>) => void;
  onSend: () => void;
  itemClassName: string;
}) {
  return (
    <>
      {!q.invoiceId ? (
        <button
          type="button"
          className={itemClassName}
          disabled={pending}
          onClick={onSend}
        >
          Enviar
        </button>
      ) : null}
      {!q.invoiceId ? (
        <Link
          href={`/quotes/${q.id}/edit`}
          className={itemClassName}
          onClick={onClose}
        >
          Modificar
        </Link>
      ) : null}
      <button
        type="button"
        className={itemClassName}
        disabled={pending}
        onClick={() => {
          onClose();
          run(() => duplicateQuote(q.id));
        }}
      >
        Duplicar
      </button>
      {!q.invoiceId ? (
        <button
          type="button"
          className={`${itemClassName} text-danger hover:bg-danger/10`}
          disabled={pending}
          onClick={() => {
            onClose();
            if (confirm(`¿Eliminar el presupuesto ${q.fullNumber}?`)) {
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
          className={itemClassName}
          disabled={pending}
          onClick={() => {
            onClose();
            run(() => convertQuoteToInvoice(q.id));
          }}
        >
          Convertir a factura
        </button>
      ) : (
        <Link
          href={`/invoices/${q.invoiceId}`}
          className={itemClassName}
          onClick={onClose}
        >
          Ver factura
        </Link>
      )}
      <div className="my-1 border-t border-line" />
      {!q.invoiceId ? (
        <>
          <button
            type="button"
            className={itemClassName}
            disabled={pending}
            onClick={() => {
              onClose();
              run(() => setQuoteStatus(q.id, "ACEPTADO"));
            }}
          >
            Aceptado
          </button>
          <button
            type="button"
            className={itemClassName}
            disabled={pending}
            onClick={() => {
              onClose();
              run(() => setQuoteStatus(q.id, "RECHAZADO"));
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
        className={itemClassName}
        onClick={onClose}
      >
        Imprimir
      </a>
      <a
        href={`/api/quotes/${q.id}/pdf?download=1`}
        className={itemClassName}
        onClick={onClose}
      >
        Descargar
      </a>
    </>
  );
}

export function QuotesTable({ quotes }: { quotes: QuoteListRow[] }) {
  const router = useRouter();
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colsOpen, setColsOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [sendId, setSendId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setVisible(loadVisible());
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function onDocPointer(e: Event) {
      const t = e.target as Node;
      if (colsRef.current && !colsRef.current.contains(t)) setColsOpen(false);
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(t)
      ) {
        setMenuId(null);
        setMenuPos(null);
      }
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    function closeMenu() {
      setMenuId(null);
      setMenuPos(null);
    }
    // On mobile the sheet shouldn't close on every scroll inside itself;
    // only close desktop floating menu on scroll.
    if (isMobile) return;
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuId, isMobile]);

  useEffect(() => {
    if (!menuId || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuId, isMobile]);

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

  const menuQuote = menuId
    ? quotes.find((q) => q.id === menuId) ?? null
    : null;

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

  function openRowMenu(qId: string, btn: HTMLButtonElement) {
    if (menuId === qId) {
      setMenuId(null);
      setMenuPos(null);
      menuBtnRef.current = null;
      return;
    }
    menuBtnRef.current = btn;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMenuPos({ top: 0, left: 0 });
      setMenuId(qId);
      return;
    }
    const rect = btn.getBoundingClientRect();
    const menuWidth = 192;
    const estimatedHeight = 320;
    const gap = 4;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < estimatedHeight && rect.top > estimatedHeight
        ? Math.max(8, rect.top - estimatedHeight - gap)
        : rect.bottom + gap;
    setMenuPos({ top, left });
    setMenuId(qId);
  }

  function closeMenu() {
    setMenuId(null);
    setMenuPos(null);
    menuBtnRef.current = null;
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
      {mounted &&
      menuQuote &&
      menuPos &&
      createPortal(
        isMobile ? (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-ink/40"
              aria-label="Cerrar"
              onClick={closeMenu}
            />
            <div
              ref={menuRef}
              className="relative max-h-[75vh] overflow-y-auto rounded-t-2xl border border-line bg-bg-elevated pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-xl"
              role="menu"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
              <p className="px-4 pb-2 font-mono text-xs text-ink-muted">
                {menuQuote.fullNumber}
                {menuQuote.isProforma ? " · Proforma" : ""}
              </p>
              <QuoteActionsMenu
                q={menuQuote}
                pending={pending}
                onClose={closeMenu}
                run={run}
                onSend={() => {
                  closeMenu();
                  setSendId(menuQuote.id);
                }}
                itemClassName="block w-full px-4 py-3.5 text-left text-base hover:bg-accent-soft"
              />
            </div>
          </div>
        ) : (
          <div
            ref={menuRef}
            className="fixed z-[100] w-48 rounded-md border border-line bg-bg-elevated py-1 text-left shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
          >
            <QuoteActionsMenu
              q={menuQuote}
              pending={pending}
              onClose={closeMenu}
              run={run}
              onSend={() => {
                closeMenu();
                setSendId(menuQuote.id);
              }}
              itemClassName="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent-soft"
            />
          </div>
        ),
        document.body
      )}
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
              <th className="sticky right-0 z-10 w-16 bg-line/20 px-2 py-3 text-right font-medium sm:w-40 sm:px-4 sm:bg-transparent">
                <span className="sr-only sm:not-sr-only">Acciones</span>
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
                  className="group cursor-pointer border-b border-line/60 hover:bg-accent-soft/40"
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
                    className="sticky right-0 z-10 bg-bg-elevated px-2 py-3 text-right group-hover:bg-accent-soft/40 sm:static sm:bg-transparent sm:px-4 sm:group-hover:bg-transparent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center justify-end gap-1">
                      {!q.invoiceId ? (
                        <button
                          type="button"
                          disabled={pending}
                          className="btn-secondary hidden px-2 py-1 text-xs sm:inline-flex"
                          onClick={() => setSendId(q.id)}
                        >
                          Enviar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost inline-flex h-10 w-10 items-center justify-center px-0 text-base leading-none sm:h-auto sm:w-auto sm:px-2 sm:py-1"
                        aria-label="Más acciones"
                        aria-expanded={menuId === q.id}
                        onClick={(e) => openRowMenu(q.id, e.currentTarget)}
                      >
                        ···
                      </button>
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
