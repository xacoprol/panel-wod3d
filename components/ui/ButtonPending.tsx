import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

/** Texto de botón con spinner cuando la acción está en curso. */
export function ButtonPending({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: ReactNode;
  busy: string;
}) {
  if (!pending) return <>{idle}</>;
  return (
    <>
      <Spinner className="h-4 w-4 border-white/30 border-t-white" label={busy} />
      {busy}
    </>
  );
}
