import Link from "next/link";
import { pageHref } from "@/lib/pagination";

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  total,
  pageSize,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-ink-muted">
      <p>
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <span className="btn-ghost pointer-events-none opacity-40">Anterior</span>
        ) : (
          <Link
            href={pageHref(basePath, params, page - 1)}
            className="btn-ghost"
          >
            Anterior
          </Link>
        )}
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        {page >= totalPages ? (
          <span className="btn-ghost pointer-events-none opacity-40">Siguiente</span>
        ) : (
          <Link
            href={pageHref(basePath, params, page + 1)}
            className="btn-ghost"
          >
            Siguiente
          </Link>
        )}
      </div>
    </div>
  );
}
