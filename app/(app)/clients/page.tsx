import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";
import { LiveSearch } from "@/components/ui/LiveSearch";

export default async function ClientsPage({
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
          { nif: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const total = await prisma.client.count({ where });
  const meta = paginationMeta(total, page);

  const clients = await prisma.client.findMany({
    where,
    orderBy: { name: "asc" },
    skip: meta.skip,
    take: meta.take,
    include: {
      _count: { select: { quotes: true, invoices: true } },
    },
  });

  const params = { q: query };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Directorio de clientes y contactos fiscales
          </p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          Nuevo cliente
        </Link>
      </div>

      <Suspense fallback={<div className="input max-w-md animate-pulse" />}>
        <LiveSearch placeholder="Buscar por nombre, NIF o email…" />
      </Suspense>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">NIF/CIF</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Alta</th>
              <th className="px-4 py-3 font-medium text-right">Docs</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  No hay clientes{query ? " con ese criterio" : ""}.{" "}
                  <Link href="/clients/new" className="text-accent underline">
                    Crear el primero
                  </Link>
                </td>
              </tr>
            ) : (
              clients.map((c) => (
                <tr
                  key={c.id}
                  className="relative cursor-pointer border-b border-line/60 transition hover:bg-accent-soft/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-ink after:absolute after:inset-0 hover:text-accent"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.nif}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-muted">
                    {c._count.quotes}P / {c._count.invoices}F
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          basePath="/clients"
          params={params}
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={meta.pageSize}
        />
      </div>
    </div>
  );
}
