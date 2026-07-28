import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/calculations";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; clientId?: string }>;
}) {
  const sp = await searchParams;
  const quotes = await prisma.quote.findMany({
    where: {
      ...(sp.status ? { status: sp.status } : {}),
      ...(sp.clientId ? { clientId: sp.clientId } : {}),
    },
    include: { client: true },
    orderBy: { issueDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Presupuestos</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Crea, envía y convierte en factura
          </p>
        </div>
        <Link href="/quotes/new" className="btn-primary">
          Nuevo presupuesto
        </Link>
      </div>

      <form className="flex flex-wrap gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="input w-auto">
          <option value="">Todos los estados</option>
          {["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "EXPIRADO"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrar
        </button>
      </form>

      <div className="card-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-line/20 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Número</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-muted">
                  No hay presupuestos.{" "}
                  <Link href="/quotes/new" className="text-accent underline">
                    Crear uno
                  </Link>
                </td>
              </tr>
            ) : (
              quotes.map((q) => (
                <tr key={q.id} className="border-b border-line/60 hover:bg-accent-soft/40">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="font-mono hover:text-accent">
                      {q.fullNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{q.client.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(Number(q.total))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
