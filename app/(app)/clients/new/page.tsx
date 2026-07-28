import Link from "next/link";
import { ClientForm } from "@/components/clients/ClientForm";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-ink-muted hover:text-accent">
          ← Clientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Nuevo cliente
        </h1>
      </div>
      <div className="card-panel p-6">
        <ClientForm />
      </div>
    </div>
  );
}
