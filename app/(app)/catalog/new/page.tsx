import Link from "next/link";
import { CatalogForm } from "@/components/catalog/CatalogForm";

export default function NewCatalogItemPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalog" className="text-sm text-ink-muted hover:text-accent">
          ← Conceptos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Nuevo concepto
        </h1>
      </div>
      <CatalogForm />
    </div>
  );
}
