"use client";

import { useTransition } from "react";
import { setInvoiceStatus } from "@/app/(app)/invoices/actions";

export function MarkPendingButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Marcar como pendiente eliminará todos los cobros registrados de esta factura. ¿Continuar?"
          )
        ) {
          return;
        }
        start(() => {
          void setInvoiceStatus(invoiceId, "PENDIENTE");
        });
      }}
    >
      Marcar pendiente
    </button>
  );
}
