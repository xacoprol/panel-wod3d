"use client";

import { useActionState } from "react";
import type { CatalogItem } from "@prisma/client";
import { VAT_RATES } from "@/lib/calculations";
import {
  createCatalogItem,
  updateCatalogItem,
  type CatalogFormState,
} from "@/app/(app)/catalog/actions";

type Props = {
  item?: CatalogItem;
};

export function CatalogForm({ item }: Props) {
  const action = item
    ? updateCatalogItem.bind(null, item.id)
    : createCatalogItem;
  const [state, formAction, pending] = useActionState<
    CatalogFormState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-5">
      {state.error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <section className="card-panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="form-section-title">
            {item ? "Editar concepto" : "Nuevo concepto"}
          </h2>
          <p className="form-section-hint">
            Reutilizable en presupuestos, facturas y periódicas
          </p>
        </div>

        <div>
          <label className="label" htmlFor="name">
            Nombre corto
          </label>
          <input
            id="name"
            name="name"
            className="input"
            required
            defaultValue={item?.name ?? ""}
            placeholder="Ej. Análisis funcional"
          />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Descripción (línea del documento)
          </label>
          <textarea
            id="description"
            name="description"
            className="input min-h-24"
            required
            defaultValue={item?.description ?? ""}
            placeholder="Texto que aparecerá en la línea"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="unitPrice">
              Precio unitario
            </label>
            <input
              id="unitPrice"
              name="unitPrice"
              type="number"
              step="0.01"
              min="0"
              className="input font-mono"
              defaultValue={item ? Number(item.unitPrice) : 0}
            />
          </div>
          <div>
            <label className="label" htmlFor="vatRate">
              IVA %
            </label>
            <select
              id="vatRate"
              name="vatRate"
              className="input"
              defaultValue={item?.vatRate ?? 21}
            >
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="defaultDiscountPct">
              Dto % por defecto
            </label>
            <input
              id="defaultDiscountPct"
              name="defaultDiscountPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="input font-mono"
              defaultValue={item?.defaultDiscountPct ?? 0}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            value="1"
            defaultChecked={item?.active ?? true}
            className="rounded border-line"
          />
          Activo (visible al añadir líneas)
        </label>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : item ? "Guardar cambios" : "Crear concepto"}
      </button>
    </form>
  );
}
