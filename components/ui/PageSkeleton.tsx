import { Spinner } from "@/components/ui/Spinner";

/** Skeleton de página para `loading.tsx` y Suspense de rutas. */
export function PageSkeleton({
  label = "Cargando…",
}: {
  label?: string;
}) {
  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-line/80" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-line/80" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-line/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-line/70" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-line/70" />
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-ink-muted">
        <Spinner className="h-4 w-4" label={label} />
        <span>{label}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-panel space-y-3 p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-line/70" />
            <div className="h-8 w-28 animate-pulse rounded bg-line/80" />
            <div className="h-3 w-36 animate-pulse rounded bg-line/50" />
          </div>
        ))}
      </div>

      <div className="card-panel overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <div className="h-4 w-40 animate-pulse rounded bg-line/70" />
        </div>
        <div className="divide-y divide-line/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-line/60" />
              <div className="h-4 flex-1 animate-pulse rounded bg-line/50" />
              <div className="h-4 w-20 shrink-0 animate-pulse rounded bg-line/60" />
              <div className="hidden h-4 w-16 shrink-0 animate-pulse rounded bg-line/50 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fallback compacto para Suspense de buscadores / filtros. */
export function InlineSkeleton({
  className = "h-10 max-w-md",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-line/70 ${className}`}
      aria-hidden
    />
  );
}
