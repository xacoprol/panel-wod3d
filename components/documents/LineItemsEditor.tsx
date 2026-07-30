"use client";

import { useMemo, useTransition } from "react";
import {
  calculateDocument,
  formatCurrency,
  VAT_RATES,
  type LineInput,
} from "@/lib/calculations";
import { CatalogPicker, type CatalogPick } from "@/components/catalog/CatalogPicker";
import { saveLineToCatalog } from "@/app/(app)/catalog/actions";

export type EditorLine = LineInput & { id: string };

/** Shared line grid so header + rows stay aligned */
const LINE_GRID =
  "md:grid-cols-[minmax(0,1fr)_4rem_5rem_4rem_4.5rem_6.5rem_2.75rem]";

type Props = {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  irpfRate?: number;
  onIrpfChange?: (rate: number) => void;
  showIrpf?: boolean;
  defaultVatRate?: number;
  /** Descuento general del documento (%) — p. ej. presupuestos */
  globalDiscountPct?: number;
  onGlobalDiscountChange?: (pct: number) => void;
  showGlobalDiscount?: boolean;
};

function newLine(vatRate = 21): EditorLine {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate,
    discountPct: 0,
  };
}

function LineActions({
  onMove,
  onRemove,
  canRemove,
}: {
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const btn =
    "inline-flex size-5 shrink-0 items-center justify-center rounded text-[11px] leading-none text-ink-muted transition hover:bg-accent-soft/50 hover:text-ink disabled:opacity-40";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <div className="flex flex-col">
        <button
          type="button"
          className={btn}
          onClick={() => onMove(-1)}
          title="Subir"
        >
          ↑
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => onMove(1)}
          title="Bajar"
        >
          ↓
        </button>
      </div>
      <button
        type="button"
        className={`${btn} text-danger hover:text-danger`}
        onClick={onRemove}
        disabled={!canRemove}
        title="Eliminar"
      >
        ×
      </button>
    </div>
  );
}

function LineFields({
  line,
  calcSubtotal,
  onUpdate,
  onMove,
  onRemove,
  canRemove,
}: {
  line: EditorLine;
  calcSubtotal: number;
  onUpdate: (patch: Partial<EditorLine>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [saving, startSave] = useTransition();

  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${LINE_GRID} md:items-center`}
    >
      <div className="col-span-2 min-w-0 sm:col-span-4 md:col-span-1">
        <div className="mb-1 flex items-center justify-between gap-2 md:sr-only">
          <label className="block text-xs text-ink-muted">Concepto</label>
        </div>
        <div className="flex gap-1">
          <input
            className="input min-w-0 flex-1"
            value={line.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Descripción del servicio o producto"
          />
          {line.description.trim() ? (
            <button
              type="button"
              className="btn-ghost hidden shrink-0 px-2 py-1 text-xs md:inline-flex"
              title="Guardar en catálogo"
              disabled={saving}
              onClick={() => {
                startSave(() => {
                  void saveLineToCatalog({
                    description: line.description,
                    unitPrice: line.unitPrice,
                    vatRate: line.vatRate,
                    discountPct: line.discountPct,
                  });
                });
              }}
            >
              ★
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-ink-muted md:sr-only">
          Cant.
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="input px-1.5 text-right tabular-nums"
          value={line.quantity}
          onChange={(e) =>
            onUpdate({ quantity: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted md:sr-only">
          Precio
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="input px-1.5 text-right tabular-nums"
          value={line.unitPrice}
          onChange={(e) =>
            onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted md:sr-only">
          Dto %
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          className="input px-1.5 text-right tabular-nums"
          value={line.discountPct}
          onChange={(e) =>
            onUpdate({ discountPct: parseFloat(e.target.value) || 0 })
          }
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink-muted md:sr-only">
          IVA %
        </label>
        <select
          className="input px-1.5"
          value={line.vatRate}
          onChange={(e) =>
            onUpdate({ vatRate: parseFloat(e.target.value) })
          }
        >
          {VAT_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-2 border-t border-line/60 pt-2 sm:col-span-4 md:col-span-1 md:justify-end md:border-0 md:pt-0">
        <span className="font-mono text-sm font-medium tabular-nums md:text-right">
          {formatCurrency(calcSubtotal)}
        </span>
        <div className="flex shrink-0 md:hidden">
          <LineActions onMove={onMove} onRemove={onRemove} canRemove={canRemove} />
        </div>
      </div>
      <div className="hidden md:flex md:items-center md:justify-end">
        <LineActions onMove={onMove} onRemove={onRemove} canRemove={canRemove} />
      </div>
    </div>
  );
}

export function LineItemsEditor({
  lines,
  onChange,
  irpfRate = 0,
  onIrpfChange,
  showIrpf = false,
  defaultVatRate = 21,
  globalDiscountPct = 0,
  onGlobalDiscountChange,
  showGlobalDiscount = false,
}: Props) {
  const totals = useMemo(
    () => calculateDocument(lines, irpfRate, globalDiscountPct),
    [lines, irpfRate, globalDiscountPct]
  );

  function update(id: string, patch: Partial<EditorLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function remove(id: string) {
    if (lines.length <= 1) return;
    onChange(lines.filter((l) => l.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = lines.findIndex((l) => l.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-3 overflow-x-auto">
          {/* Desktop header — same grid + padding as rows */}
          <div
            className={`hidden gap-2 px-2 text-xs font-medium uppercase tracking-wide text-ink-muted md:grid ${LINE_GRID} md:items-center`}
          >
            <span>Concepto</span>
            <span className="px-1.5 text-right">Cant.</span>
            <span className="px-1.5 text-right">Precio</span>
            <span className="px-1.5 text-right">Dto %</span>
            <span className="px-1.5 text-right">IVA %</span>
            <span className="text-right">Importe</span>
            <span aria-hidden className="block" />
          </div>

          {lines.map((line, i) => {
            const calc = totals.lines[i];
            return (
              <div
                key={line.id}
                className="rounded-xl border border-line bg-bg p-3 transition hover:border-accent/30 hover:bg-accent-soft/20 md:border-transparent md:bg-transparent md:p-2 md:hover:bg-accent-soft/30"
              >
                <LineFields
                  line={line}
                  calcSubtotal={calc?.lineSubtotal ?? 0}
                  onUpdate={(patch) => update(line.id, patch)}
                  onMove={(dir) => move(line.id, dir)}
                  onRemove={() => remove(line.id)}
                  canRemove={lines.length > 1}
                />
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg/50 px-4 py-3.5 text-sm font-medium text-ink-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
              onClick={() => onChange([...lines, newLine(defaultVatRate)])}
            >
              + Añadir línea
            </button>
            <CatalogPicker
              onPick={(item: CatalogPick) => {
                onChange([
                  ...lines,
                  {
                    id: crypto.randomUUID(),
                    description: item.description,
                    quantity: 1,
                    unitPrice: item.unitPrice,
                    vatRate: item.vatRate,
                    discountPct: item.defaultDiscountPct,
                  },
                ]);
              }}
            />
          </div>
        </div>

        <aside className="h-fit space-y-3 rounded-xl border border-line bg-accent-soft/35 p-4 text-sm lg:sticky lg:top-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Resumen
          </p>
          {showGlobalDiscount ? (
            <div className="flex items-center justify-between gap-3">
              <label className="text-ink-muted" htmlFor="discountPct">
                Dto. general
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="discountPct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  className="w-16 rounded-md border border-line bg-bg-elevated px-1.5 py-1 text-right font-mono text-sm"
                  value={globalDiscountPct}
                  onChange={(e) =>
                    onGlobalDiscountChange?.(parseFloat(e.target.value) || 0)
                  }
                />
                <span className="text-ink-muted">%</span>
              </div>
            </div>
          ) : null}
          {showGlobalDiscount && totals.discountAmount > 0 ? (
            <>
              <div className="flex justify-between text-xs text-ink-muted">
                <span>Base bruta</span>
                <span className="font-mono">
                  {formatCurrency(totals.grossSubtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Descuento</span>
                <span className="font-mono text-danger">
                  −{formatCurrency(totals.discountAmount)}
                </span>
              </div>
            </>
          ) : null}
          <div className="flex justify-between">
            <span className="text-ink-muted">Base imponible</span>
            <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
          </div>
          {totals.vatBreakdown.map((v) => (
            <div key={v.rate} className="flex justify-between">
              <span className="text-ink-muted">IVA {v.rate}%</span>
              <span className="font-mono">{formatCurrency(v.amount)}</span>
            </div>
          ))}
          {showIrpf && (
            <div className="flex items-center justify-between gap-3 border-t border-line/80 pt-2">
              <label className="text-ink-muted">
                IRPF{" "}
                <select
                  className="ml-1 rounded-md border border-line bg-bg-elevated px-1 py-0.5"
                  value={irpfRate}
                  onChange={(e) =>
                    onIrpfChange?.(parseFloat(e.target.value) || 0)
                  }
                >
                  {[0, 7, 15].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </label>
              <span className="font-mono text-danger">
                −{formatCurrency(totals.irpfAmount)}
              </span>
            </div>
          )}
          <div className="border-t border-line/80 pt-3">
            <p className="text-xs text-ink-muted">Total</p>
            <p className="font-mono text-2xl font-semibold tracking-tight text-accent">
              {formatCurrency(totals.total)}
            </p>
          </div>
        </aside>
      </div>

      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />
      {showIrpf && (
        <input type="hidden" name="irpfRate" value={String(irpfRate)} />
      )}
      {showGlobalDiscount && (
        <input
          type="hidden"
          name="discountPct"
          value={String(globalDiscountPct)}
        />
      )}
    </div>
  );
}

export function createEmptyLines(vatRate = 21): EditorLine[] {
  return [newLine(vatRate)];
}
