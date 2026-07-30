"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { formatCurrency } from "@/lib/calculations";

export type CatalogPick = {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  defaultDiscountPct: number;
};

type Props = {
  onPick: (item: CatalogPick) => void;
};

type SearchResponse = { items: CatalogPick[] };

export function CatalogPicker({ onPick }: Props) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogPick[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((term: string) => {
    startTransition(() => {
      void fetch(`/api/catalog/search?q=${encodeURIComponent(term)}&limit=12`)
        .then(async (res) => {
          if (!res.ok) throw new Error("fail");
          return res.json() as Promise<SearchResponse>;
        })
        .then((data) => {
          setResults(data.items);
          setHighlight(0);
        })
        .catch(() => setResults([]));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    search(query);
  }, [open, query, search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function select(item: CatalogPick) {
    onPick(item);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="btn-secondary text-sm"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) search("");
        }}
      >
        Desde catálogo
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded-lg border border-line bg-bg-elevated p-2 shadow-lg sm:w-96">
          <input
            id={inputId}
            className="input text-sm"
            placeholder="Buscar concepto…"
            value={query}
            autoFocus
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => search(v), 200);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter" && results[highlight]) {
                e.preventDefault();
                select(results[highlight]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          <ul className="mt-2 max-h-56 overflow-auto text-sm">
            {pending && results.length === 0 ? (
              <li className="px-2 py-3 text-ink-muted">Buscando…</li>
            ) : results.length === 0 ? (
              <li className="px-2 py-3 text-ink-muted">Sin resultados</li>
            ) : (
              results.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition ${
                      i === highlight
                        ? "bg-accent-soft text-ink"
                        : "hover:bg-accent-soft/50"
                    }`}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => select(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="line-clamp-1 text-xs text-ink-muted">
                      {item.description}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {formatCurrency(item.unitPrice)} · IVA {item.vatRate}%
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
