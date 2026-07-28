const STATUS_STYLES: Record<string, string> = {
  BORRADOR: "bg-line/60 text-ink-muted",
  ENVIADO: "bg-accent-soft text-accent",
  ACEPTADO: "bg-success/15 text-success",
  RECHAZADO: "bg-danger/15 text-danger",
  EXPIRADO: "bg-warning/15 text-warning",
  PENDIENTE: "bg-warning/15 text-warning",
  PAGADA: "bg-success/15 text-success",
  VENCIDA: "bg-danger/15 text-danger",
  ANULADA: "bg-line/60 text-ink-muted line-through",
  ACTIVA: "bg-success/15 text-success",
  PAUSADA: "bg-warning/15 text-warning",
  FINALIZADA: "bg-line/60 text-ink-muted",
};

const LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "Enviado",
  ACEPTADO: "Aceptado",
  RECHAZADO: "Rechazado",
  EXPIRADO: "Expirado",
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
  ACTIVA: "Activa",
  PAUSADA: "Pausada",
  FINALIZADA: "Finalizada",
  MENSUAL: "Mensual",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] ?? "bg-line/60 text-ink-muted"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}

export function statusLabel(status: string) {
  return LABELS[status] ?? status;
}
