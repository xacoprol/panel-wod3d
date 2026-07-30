"use client";

import type { ReactNode } from "react";

type ShellProps = {
  docKind: "Presupuesto" | "Proforma" | "Factura";
  numberLabel?: string;
  subtitle?: string;
  children: ReactNode;
};

export function DocumentFormShell({
  docKind,
  numberLabel,
  subtitle,
  children,
}: ShellProps) {
  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="badge bg-accent-soft text-accent">{docKind}</span>
          {numberLabel ? (
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink">
              {numberLabel}
            </p>
          ) : null}
          {subtitle ? (
            <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

type SectionProps = {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function DocumentFormSection({
  title,
  hint,
  children,
  className = "",
}: SectionProps) {
  return (
    <section className={`card-panel p-5 sm:p-6 ${className}`}>
      <div className="mb-4 border-b border-line/70 pb-3">
        <h2 className="form-section-title">{title}</h2>
        {hint ? <p className="form-section-hint">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

type StickyBarProps = {
  totalLabel: string;
  totalValue: string;
  children: ReactNode;
};

export function DocumentFormStickyBar({
  totalLabel,
  totalValue,
  children,
}: StickyBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated/95 px-4 py-3 shadow-[0_-8px_24px_rgb(26_21_40_/_0.08)] backdrop-blur-md md:left-56">
      <div className="pointer-events-auto mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {totalLabel}
          </p>
          <p className="font-mono text-xl font-semibold text-accent">
            {totalValue}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}
