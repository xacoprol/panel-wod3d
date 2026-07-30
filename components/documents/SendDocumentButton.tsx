"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SendDocumentModal,
} from "@/components/documents/SendDocumentModal";
import type { SendDocKind } from "@/app/(app)/documents/send-actions";

type Props = {
  kind: SendDocKind;
  id: string;
  className?: string;
  label?: string;
};

export function SendDocumentButton({
  kind,
  id,
  className = "btn-secondary",
  label = "Enviar",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <SendDocumentModal
        kind={kind}
        id={id}
        open={open}
        onClose={() => setOpen(false)}
        onSent={() => router.refresh()}
      />
    </>
  );
}
