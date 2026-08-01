"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  syncShopifyMonthAction,
  syncShopifyRecentAction,
  testShopifyConnectionAction,
} from "@/app/(app)/fiscal/income/shopify-actions";

type Props = {
  ready: boolean;
  shop: string | null;
  lastSyncAt: string | null;
};

export function ShopifySyncCard({ ready, shop, lastSyncAt }: Props) {
  const now = useMemo(() => new Date(), []);
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<
      | { ok: true; message?: string; shopName?: string }
      | { ok: false; error: string }
    >
  ) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        if ("message" in res && res.message) setMessage(res.message);
        else if ("shopName" in res && res.shopName)
          setMessage(`Conectado: ${res.shopName}`);
        else setMessage("OK");
      } else {
        setError(res.error);
      }
    });
  }

  if (!ready) {
    return (
      <section className="card-panel space-y-2 p-4 sm:p-5">
        <h2 className="form-section-title">Shopify API</h2>
        <p className="text-sm text-ink-muted">
          Para sincronizar sin CSV: crea la app en{" "}
          <a
            href="https://dev.shopify.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            Dev Dashboard
          </a>{" "}
          y pega Client ID + Secret en{" "}
          <Link href="/settings" className="text-accent underline">
            Ajustes
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="card-panel space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="form-section-title">Shopify API</h2>
        <p className="form-section-hint">
          Tienda <span className="font-mono">{shop}</span>
          {lastSyncAt
            ? ` · última sync ${new Date(lastSyncAt).toLocaleString("es-ES")}`
            : " · aún sin sincronizar"}
          . Trae pedidos pagados a Ingresos marketplace (actualiza si ya
          existen).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="shopifySyncMonth">
            Mes
          </label>
          <select
            id="shopifySyncMonth"
            className="input w-auto"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={pending}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="shopifySyncYear">
            Año
          </label>
          <select
            id="shopifySyncYear"
            className="input w-auto"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={pending}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
              (y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            )}
          </select>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={pending}
          onClick={() => run(() => syncShopifyMonthAction(year, month))}
        >
          {pending ? "Sincronizando…" : "Sync mes"}
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={pending}
          onClick={() => run(() => syncShopifyRecentAction(60))}
        >
          Sync 60 días
        </button>
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={pending}
          onClick={() => run(() => testShopifyConnectionAction())}
        >
          Probar conexión
        </button>
      </div>

      {message ? (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
