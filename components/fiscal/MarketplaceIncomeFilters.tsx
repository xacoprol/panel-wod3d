"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Props = {
  years: number[];
};

export function MarketplaceIncomeFilters({ years }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const channel = searchParams.get("channel") ?? "";
  const vat = searchParams.get("vat") ?? "";
  const year = searchParams.get("year") ?? "";
  const month = searchParams.get("month") ?? "";

  function patchParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearFilters() {
    patchParams({
      channel: null,
      vat: null,
      year: null,
      month: null,
    });
  }

  const hasFilters = Boolean(channel || vat || year || month);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label" htmlFor="mktChannel">
          Canal
        </label>
        <select
          id="mktChannel"
          className="input w-auto min-w-[8rem]"
          value={channel}
          disabled={pending}
          onChange={(e) => patchParams({ channel: e.target.value || null })}
        >
          <option value="">Todos</option>
          <option value="AMAZON">Amazon</option>
          <option value="SHOPIFY">Shopify</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="mktVat">
          IVA
        </label>
        <select
          id="mktVat"
          className="input w-auto min-w-[9rem]"
          value={vat}
          disabled={pending}
          onChange={(e) => patchParams({ vat: e.target.value || null })}
        >
          <option value="">Todos</option>
          <option value="TAXABLE">Con IVA</option>
          <option value="EXEMPT">Sin IVA</option>
          <option value="MARKETPLACE_COLLECTED">OSS marketplace</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="mktYear">
          Año
        </label>
        <select
          id="mktYear"
          className="input w-auto"
          value={year}
          disabled={pending}
          onChange={(e) => {
            const y = e.target.value;
            patchParams({
              year: y || null,
              month: y ? month || null : null,
            });
          }}
        >
          <option value="">Todos</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="mktMonth">
          Mes
        </label>
        <select
          id="mktMonth"
          className="input w-auto"
          value={month}
          disabled={pending || !year}
          onChange={(e) => patchParams({ month: e.target.value || null })}
        >
          <option value="">Todos</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>
              {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      {hasFilters ? (
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={pending}
          onClick={clearFilters}
        >
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
