import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/calculations";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { LiveSearch } from "@/components/ui/LiveSearch";
import {
  deleteCatalogItem,
  toggleCatalogItemActive,
} from "./actions";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const query = sp.q?.trim();
  const page = parsePage(sp.page);

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const total = await prisma.catalogItem.count({ where });
  const meta = paginationMeta(total, page);
  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    skip: meta.skip,
    take: meta.take,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conceptos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Catálogo reutilizable para líneas de documentos
          </p>
        </div>
        <Link href="/catalog/new" className="btn-primary">
          Nuevo concepto
        </Link>
      </div>

      <Suspense fallback={<div className="input max-w-md animate-pulse" />}>
        <LiveSearch placeholder="Buscar por nombre o descripción…" />
      </Suspense>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Precio</th>
              <th className="px-4 py-3 font-medium text-right">IVA</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  No hay conceptos{query ? " con ese criterio" : ""}.{" "}
                  <Link href="/catalog/new" className="text-accent underline">
                    Crear el primero
                  </Link>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-line/50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-ink-muted">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(item.unitPrice))}
                  </td>
                  <td className="px-4 py-3 text-right">{item.vatRate}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge ${
                        item.active
                          ? "bg-success/15 text-success"
                          : "bg-line text-ink-muted"
                      }`}
                    >
                      {item.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/catalog/${item.id}/edit`}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        Editar
                      </Link>
                      <form action={toggleCatalogItemActive.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="btn-ghost px-2 py-1 text-xs"
                        >
                          {item.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                      <form action={deleteCatalogItem.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="btn-ghost px-2 py-1 text-xs text-danger"
                        >
                          Borrar
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/catalog"
        params={{ q: query }}
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        pageSize={meta.pageSize}
      />
    </div>
  );
}
