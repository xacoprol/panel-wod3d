import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClientForm } from "@/components/clients/ClientForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/clients/${id}`}
          className="text-sm text-ink-muted hover:text-accent"
        >
          ← {client.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar cliente
        </h1>
      </div>
      <div className="card-panel p-6">
        <ClientForm client={client} />
      </div>
    </div>
  );
}
