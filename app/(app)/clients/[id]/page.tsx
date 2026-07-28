import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { deleteClient } from "../actions";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      quotes: { orderBy: { issueDate: "desc" }, take: 20 },
      invoices: { orderBy: { issueDate: "desc" }, take: 20 },
    },
  });
  if (!client) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-sm text-ink-muted hover:text-accent">
            ← Clientes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {client.name}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink-muted">{client.nif}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/clients/${id}/edit`} className="btn-secondary">
            Editar
          </Link>
          <Link
            href={`/quotes/new?clientId=${id}`}
            className="btn-primary"
          >
            Nuevo presupuesto
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-panel space-y-3 p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Datos
          </h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-ink-muted">Dirección</dt>
              <dd>
                {client.addressStreet}
                <br />
                {client.addressZip} {client.addressCity}
                <br />
                {client.addressProvince}, {client.addressCountry}
              </dd>
            </div>
            {client.email && (
              <div>
                <dt className="text-ink-muted">Email</dt>
                <dd>{client.email}</dd>
              </div>
            )}
            {client.phone && (
              <div>
                <dt className="text-ink-muted">Teléfono</dt>
                <dd>{client.phone}</dd>
              </div>
            )}
            {client.contactPerson && (
              <div>
                <dt className="text-ink-muted">Contacto</dt>
                <dd>{client.contactPerson}</dd>
              </div>
            )}
            {client.notes && (
              <div>
                <dt className="text-ink-muted">Notas</dt>
                <dd className="whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-ink-muted">Alta</dt>
              <dd>{formatDate(client.createdAt)}</dd>
            </div>
          </dl>
          <form
            action={async () => {
              "use server";
              await deleteClient(id);
            }}
            className="pt-4"
          >
            <button type="submit" className="btn-ghost text-danger text-xs">
              Eliminar cliente
            </button>
          </form>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="card-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Presupuestos</h2>
              <Link
                href={`/quotes/new?clientId=${id}`}
                className="text-xs text-accent hover:underline"
              >
                Nuevo
              </Link>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {client.quotes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-ink-muted">
                      Sin presupuestos
                    </td>
                  </tr>
                ) : (
                  client.quotes.map((q) => (
                    <tr key={q.id} className="border-b border-line/50">
                      <td className="px-4 py-2">
                        <Link href={`/quotes/${q.id}`} className="hover:text-accent">
                          {q.fullNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-ink-muted">
                        {formatDate(q.issueDate)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(Number(q.total))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section className="card-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Facturas</h2>
              <Link
                href={`/invoices/new?clientId=${id}`}
                className="text-xs text-accent hover:underline"
              >
                Nueva
              </Link>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {client.invoices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-ink-muted">
                      Sin facturas
                    </td>
                  </tr>
                ) : (
                  client.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-line/50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:text-accent"
                        >
                          {inv.fullNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-ink-muted">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(Number(inv.total))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
