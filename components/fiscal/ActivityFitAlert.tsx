import type { ActivityFit } from "@/lib/gemini-expense";

type Props = {
  activityFit: ActivityFit;
  activityFitReason?: string | null;
  homeOfficeTip?: string | null;
  className?: string;
};

export function ActivityFitAlert({
  activityFit,
  activityFitReason,
  homeOfficeTip,
  className = "",
}: Props) {
  if (activityFit === "ok" && !homeOfficeTip) return null;

  if (activityFit === "suspicious") {
    return (
      <div
        className={`rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning ${className}`}
        role="status"
      >
        <p className="font-medium">Gasto poco relacionado con WOD3D</p>
        <p className="mt-1 text-xs opacity-95">
          {activityFitReason ??
            "Este concepto no parece encajar con impresión 3D, láser o merchandising. Revísalo antes de marcarlo como deducible."}
        </p>
        <p className="mt-1.5 text-xs opacity-80">
          Puedes guardarlo igual (p. ej. sin deducible) si lo necesitas en el
          listado.
        </p>
      </div>
    );
  }

  // partial or home-office tip on ok
  return (
    <div
      className={`rounded-lg border border-line bg-accent-soft/50 px-3 py-2.5 text-sm text-ink ${className}`}
      role="status"
    >
      <p className="font-medium">
        {activityFit === "partial"
          ? "Gasto mixto / home office"
          : "Aviso home office"}
      </p>
      {activityFitReason ? (
        <p className="mt-1 text-xs text-ink-muted">{activityFitReason}</p>
      ) : null}
      {homeOfficeTip ? (
        <p className="mt-1 text-xs text-ink-muted">{homeOfficeTip}</p>
      ) : (
        <p className="mt-1 text-xs text-ink-muted">
          Si es luz, agua, internet u otro suministro de la vivienda, suele
          deducirse solo el porcentaje afecto a la actividad (no el 100 %).
          Ajusta la base o las notas según tu criterio / gestor.
        </p>
      )}
    </div>
  );
}
