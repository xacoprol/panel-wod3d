export const PAGE_SIZE = 50;

export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function paginationMeta(total: number, page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const skip = (current - 1) * pageSize;
  return { total, totalPages, page: current, pageSize, skip, take: pageSize };
}

/** Construye querystring conservando filtros y cambiando `page`. */
export function pageHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page") continue;
    if (v != null && v !== "") sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}
