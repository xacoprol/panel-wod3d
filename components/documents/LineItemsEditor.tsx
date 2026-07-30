"use client";

import { useMemo } from "react";
import {
  calculateDocument,
  formatCurrency,
  VAT_RATES,
  type LineInput,
} from "@/lib/calculations";

export type EditorLine = LineInput & { id: string };

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
  return (
    <>
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-xs text-ink-muted md:sr-only">
          Concepto
        </label>
        <input
          className="input"
          value={line.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Descripción del servicio o producto"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:contents">
        <div className="md:w-20">
          <label className="mb-1 block text-xs text-ink-muted md:sr-only">
            Cant.
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input text-right"
            value={line.quantity}
            onChange={(e) =>
              onUpdate({ quantity: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="md:w-28">
          <label className="mb-1 block text-xs text-ink-muted md:sr-only">
            Precio
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input text-right"
            value={line.unitPrice}
            onChange={(e) =>
              onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="md:w-20">
          <label className="mb-1 block text-xs text-ink-muted md:sr-only">
            Dto %
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="input text-right"
            value={line.discountPct}
            onChange={(e) =>
              onUpdate({ discountPct: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="md:w-24">
          <label className="mb-1 block text-xs text-ink-muted md:sr-only">
            IVA %
          </label>
          <select
            className="input"
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
      </div>
      <div className="flex items-center justify-between gap-2 md:w-28 md:justify-end">
        <span className="font-mono text-sm font-medium tabular-nums">
          {formatCurrency(calcSubtotal)}
        </span>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            className="btn-ghost px-1.5 py-1 text-xs"
            onClick={() => onMove(-1)}
            title="Subir"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-1 text-xs"
            onClick={() => onMove(1)}
            title="Bajar"
          >
            ↓
          </button>
          <button
            type="button"
            className="btn-ghost px-1.5 py-1 text-xs text-danger"
            onClick={onRemove}
            disabled={!canRemove}
            title="Eliminar"
          >
            ×
          </button>
        </div>
      </div>
    </>
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
        <div className="space-y-3">
          {/* Desktop header */}
          <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-ink-muted md:flex md:items-center">
            <span className="min-w-0 flex-1">Concepto</span>
            <span className="w-20 text-right">Cant.</span>
            <span className="w-28 text-right">Precio</span>
            <span className="w-20 text-right">Dto %</span>
            <span className="w-24 text-right">IVA %</span>
            <span className="w-28 text-right">Importe</span>
          </div>

          {lines.map((line, i) => {
            const calc = totals.lines[i];
            return (
              <div
                key={line.id}
                className="rounded-xl border border-line bg-bg p-3 transition hover:border-accent/30 hover:bg-accent-soft/20 md:flex md:items-start md:gap-2 md:bg-transparent md:p-2 md:hover:bg-accent-soft/30"
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

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-bg/50 px-4 py-3.5 text-sm font-medium text-ink-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
            onClick={() => onChange([...lines, newLine(defaultVatRate)])}
          >
            + Añadir línea
          </button>
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
