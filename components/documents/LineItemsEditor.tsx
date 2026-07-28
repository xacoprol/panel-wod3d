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

export function LineItemsEditor({
  lines,
  onChange,
  irpfRate = 0,
  onIrpfChange,
  showIrpf = false,
  defaultVatRate = 21,
}: Props) {
  const totals = useMemo(
    () => calculateDocument(lines, irpfRate),
    [lines, irpfRate]
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
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-line/25 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-2 py-2 text-left font-medium">Concepto</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Cant.</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Precio</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Dto %</th>
              <th className="w-24 px-2 py-2 text-right font-medium">IVA %</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Importe</th>
              <th className="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const calc = totals.lines[i];
              return (
                <tr key={line.id} className="border-t border-line/60">
                  <td className="px-2 py-1.5">
                    <input
                      className="input"
                      value={line.description}
                      onChange={(e) =>
                        update(line.id, { description: e.target.value })
                      }
                      placeholder="Descripción del servicio o producto"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-right"
                      value={line.quantity}
                      onChange={(e) =>
                        update(line.id, {
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-right"
                      value={line.unitPrice}
                      onChange={(e) =>
                        update(line.id, {
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="input text-right"
                      value={line.discountPct}
                      onChange={(e) =>
                        update(line.id, {
                          discountPct: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className="input"
                      value={line.vatRate}
                      onChange={(e) =>
                        update(line.id, {
                          vatRate: parseFloat(e.target.value),
                        })
                      }
                    >
                      {VAT_RATES.map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs">
                    {formatCurrency(calc?.lineSubtotal ?? 0)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      <button
                        type="button"
                        className="btn-ghost px-1.5 py-1 text-xs"
                        onClick={() => move(line.id, -1)}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-1.5 py-1 text-xs"
                        onClick={() => move(line.id, 1)}
                        title="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-1.5 py-1 text-xs text-danger"
                        onClick={() => remove(line.id)}
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => onChange([...lines, newLine(defaultVatRate)])}
      >
        + Añadir línea
      </button>

      <div className="ml-auto max-w-xs space-y-2 rounded-lg border border-line bg-bg-elevated p-4 text-sm">
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
          <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
            <label className="text-ink-muted">
              IRPF{" "}
              <select
                className="ml-1 rounded border border-line bg-transparent px-1"
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
        <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono">{formatCurrency(totals.total)}</span>
        </div>
      </div>

      {/* Hidden fields for server actions */}
      <input type="hidden" name="linesJson" value={JSON.stringify(lines)} />
      {showIrpf && (
        <input type="hidden" name="irpfRate" value={String(irpfRate)} />
      )}
    </div>
  );
}

export function createEmptyLines(vatRate = 21): EditorLine[] {
  return [newLine(vatRate)];
}
