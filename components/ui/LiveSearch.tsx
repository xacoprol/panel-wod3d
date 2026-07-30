"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  param?: string;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
};

/** Buscador live: actualiza ?q= al escribir (debounce), sin botón. */
export function LiveSearch({
  param = "q",
  placeholder = "Buscar…",
  className = "input max-w-md",
  debounceMs = 320,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setValue(urlValue);
  }, [urlValue]);

  function pushQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set(param, trimmed);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    skipSyncRef.current = true;
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => pushQuery(next), debounceMs);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (timerRef.current) clearTimeout(timerRef.current);
          pushQuery(value);
        }
      }}
      placeholder={placeholder}
      className={className}
      aria-label={placeholder}
    />
  );
}

type LiveSelectProps = {
  param: string;
  label?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
  className?: string;
};

/** Select que aplica el filtro al cambiar, sin botón. */
export function LiveSelect({
  param,
  label,
  options,
  allLabel = "Todos",
  className = "input w-auto",
}: LiveSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";
  const [, startTransition] = useTransition();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(param, next);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div>
      {label ? <label className="label">{label}</label> : null}
      <select
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type LiveDateProps = {
  param: string;
  label?: string;
  className?: string;
};

/** Fecha que aplica el filtro al cambiar, sin botón. */
export function LiveDate({
  param,
  label,
  className = "input w-auto",
}: LiveDateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(param) ?? "";
  const [, startTransition] = useTransition();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(param, next);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div>
      {label ? (
        <label className="label" htmlFor={`live-date-${param}`}>
          {label}
        </label>
      ) : null}
      <input
        id={`live-date-${param}`}
        type="date"
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          const el = e.currentTarget as HTMLInputElement & {
            showPicker?: () => void;
          };
          el.showPicker?.();
        }}
      />
    </div>
  );
}
