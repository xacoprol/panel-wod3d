import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parsePage, paginationMeta } from "@/lib/pagination";
import { Pagination } from "@/components/ui/Pagination";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);

  const total = await prisma.recurringInvoiceTemplate.count();
  const meta = paginationMeta(total, page);

  const [templates, logs] = await Promise.all([
    prisma.recurringInvoiceTemplate.findMany({
      include: {
        client: true,
        _count: { select: { invoices: true } },
      },
      orderBy: { nextRunDate: "asc" },
      skip: meta.skip,
      take: meta.take,
    }),
    prisma.cronRunLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Facturas periódicas
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Plantillas y generación automática vía cron
          </p>
        </div>
        <Link href="/recurring/new" className="btn-primary">
          Nueva plantilla
        </Link>
      </div>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Frecuencia</th>
              <th className="px-4 py-3 font-medium">Próxima</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Generadas</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">
                  Sin plantillas.{" "}
                  <Link href="/recurring/new" className="text-accent underline">
                    Crear una
                  </Link>
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr
                  key={t.id}
                  className="relative border-b border-line/60 hover:bg-accent-soft/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/recurring/${t.id}`}
                      className="after:absolute after:inset-0 hover:text-accent"
                    >
                      {t.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.client.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.frequency} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(t.nextRunDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{t._count.invoices}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          basePath="/recurring"
          params={{}}
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          pageSize={meta.pageSize}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Log de ejecuciones cron
        </h2>
        <div className="card-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-line/20 text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Inicio</th>
                <th className="px-4 py-2 text-left font-medium">Resultado</th>
                <th className="px-4 py-2 text-right font-medium">Plantillas</th>
                <th className="px-4 py-2 text-right font-medium">Facturas</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                    Aún no hay ejecuciones. Invoca{" "}
                    <code className="font-mono text-xs">
                      /api/cron/generate-recurring-invoices
                    </code>{" "}
                    con el header Authorization.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-line/50">
                    <td className="px-4 py-2 font-mono text-xs">
                      {l.startedAt.toLocaleString("es-ES")}
                    </td>
                    <td className="px-4 py-2">
                      {l.success ? (
                        <span className="text-success">OK</span>
                      ) : (
                        <span className="text-danger">Error</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{l.templatesChecked}</td>
                    <td className="px-4 py-2 text-right">{l.invoicesCreated}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
