import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CatalogForm } from "@/components/catalog/CatalogForm";

export default async function EditCatalogItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalog" className="text-sm text-ink-muted hover:text-accent">
          ← Conceptos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Editar concepto
        </h1>
      </div>
      <CatalogForm item={item} />
    </div>
  );
}
