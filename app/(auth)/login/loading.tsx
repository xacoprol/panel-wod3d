import { Spinner } from "@/components/ui/Spinner";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-ink-muted">
      <Spinner label="Cargando" />
      <span>Cargando…</span>
    </div>
  );
}
