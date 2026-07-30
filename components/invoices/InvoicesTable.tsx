"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type InvoiceListRow = {
  id: string;
  fullNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  paymentMethod: string | null;
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  irpfRate: number;
  irpfAmount: number;
  total: number;
  pendingAmount: number;
  createdAt: string;
  updatedAt: string;
  primaryVatRate: number | null;
  description: string | null;
  legal: string | null;
  clientName: string;
  clientNif: string;
};

type ColumnId =
  | "cliente"
  | "nif"
  | "fecha"
  | "fCreacion"
  | "ultimaModif"
  | "numero"
  | "vencimiento"
  | "total"
  | "estado"
  | "importePendiente"
  | "descripcion"
  | "baseImponible"
  | "pctIva"
  | "cuotaIva"
  | "cuotaRe"
  | "pctRetencion"
  | "cuotaRetencion"
  | "formaCobro"
  | "observaciones"
  | "legal";

type ColumnDef = {
  id: ColumnId;
  label: string;
  locked?: boolean;
  align?: "left" | "right";
};

const COLUMNS: ColumnDef[] = [
  { id: "cliente", label: "Cliente", locked: true },
  { id: "nif", label: "NIF / CIF" },
  { id: "fecha", label: "Fecha", locked: true },
  { id: "fCreacion", label: "F. creación" },
  { id: "ultimaModif", label: "Última modif." },
  { id: "numero", label: "Número" },
  { id: "vencimiento", label: "Vencimiento" },
  { id: "total", label: "Total (€)", locked: true, align: "right" },
  { id: "estado", label: "Estado" },
  { id: "importePendiente", label: "Importe pendiente (€)", align: "right" },
  { id: "descripcion", label: "Descripción" },
  { id: "baseImponible", label: "Base imponible", align: "right" },
  { id: "pctIva", label: "% IVA", align: "right" },
  { id: "cuotaIva", label: "Cuota IVA", align: "right" },
  { id: "cuotaRe", label: "Cuota R.E.", align: "right" },
  { id: "pctRetencion", label: "% Retención", align: "right" },
  { id: "cuotaRetencion", label: "Cuota retención", align: "right" },
  { id: "formaCobro", label: "Forma de cobro" },
  { id: "observaciones", label: "Observaciones" },
  { id: "legal", label: "Legal" },
];

const DEFAULT_VISIBLE: ColumnId[] = [
  "cliente",
  "fecha",
  "numero",
  "vencimiento",
  "estado",
  "total",
];

const STORAGE_KEY = "invoices-list-columns-v1";

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

function cellValue(inv: InvoiceListRow, id: ColumnId): ReactNode {
  switch (id) {
    case "cliente":
      return inv.clientName;
    case "nif":
      return <span className="font-mono text-xs">{inv.clientNif}</span>;
    case "fecha":
      return formatDate(inv.issueDate);
    case "fCreacion":
      return formatDate(inv.createdAt);
    case "ultimaModif":
      return formatDate(inv.updatedAt);
    case "numero":
      return <span className="font-mono">{inv.fullNumber}</span>;
    case "vencimiento":
      return formatDate(inv.dueDate);
    case "total":
      return formatCurrency(inv.total);
    case "estado":
      return <StatusBadge status={inv.status} />;
    case "importePendiente":
      return formatCurrency(inv.pendingAmount);
    case "descripcion":
      return (
        <span className="line-clamp-2 max-w-[14rem] text-ink-muted">
          {inv.description || "—"}
        </span>
      );
    case "baseImponible":
      return formatCurrency(inv.subtotal);
    case "pctIva":
      return inv.primaryVatRate != null ? `${inv.primaryVatRate}%` : "—";
    case "cuotaIva":
      return formatCurrency(inv.vatAmount);
    case "cuotaRe":
      return "—";
    case "pctRetencion":
      return inv.irpfRate ? `${inv.irpfRate}%` : "—";
    case "cuotaRetencion":
      return inv.irpfAmount
        ? formatCurrency(inv.irpfAmount)
        : "—";
    case "formaCobro":
      return inv.paymentMethod || "—";
    case "observaciones":
      return (
        <span className="line-clamp-2 max-w-[14rem] text-ink-muted">
          {inv.notes || "—"}
        </span>
      );
    case "legal":
      return inv.legal || "—";
    default:
      return null;
  }
}

export function InvoicesTable({ invoices }: { invoices: InvoiceListRow[] }) {
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(loadVisible());
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (colsRef.current && !colsRef.current.contains(t)) setColsOpen(false);
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

  return (
    <div className="card-panel overflow-visible">
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
              <th className="relative w-28 px-4 py-3 text-right font-medium">
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
                    <div className="absolute right-0 z-30 mt-1 w-80 rounded-md border border-line bg-bg-elevated p-3 text-left shadow-lg normal-case tracking-normal">
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
            {invoices.length === 0 ? (
              <tr>
                <td
                  colSpan={activeCols.length + 1}
                  className="px-4 py-10 text-center text-ink-muted"
                >
                  No hay facturas.{" "}
                  <Link href="/invoices/new" className="text-accent underline">
                    Emitir una
                  </Link>
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-line/60 hover:bg-accent-soft/40"
                >
                  {activeCols.map((c) => (
                    <td
                      key={c.id}
                      className={`px-4 py-3 ${
                        c.align === "right" ? "text-right font-mono" : ""
                      } ${
                        c.id === "fecha" ||
                        c.id === "fCreacion" ||
                        c.id === "ultimaModif" ||
                        c.id === "vencimiento"
                          ? "text-ink-muted"
                          : ""
                      }`}
                    >
                      {c.id === "cliente" || c.id === "numero" ? (
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:text-accent"
                        >
                          {cellValue(inv, c.id)}
                        </Link>
                      ) : (
                        cellValue(inv, c.id)
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        Ver
                      </Link>
                      <a
                        href={`/api/invoices/${inv.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        PDF
                      </a>
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
