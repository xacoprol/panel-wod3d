"use client";

import { useState } from "react";
import { SendReminderModal } from "@/components/documents/SendReminderModal";

export function SendReminderButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen(true)}
      >
        Enviar recordatorio
      </button>
      <SendReminderModal
        invoiceId={invoiceId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
