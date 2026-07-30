type Props = {
  className?: string;
  /** Accesible: anuncia carga a lectores de pantalla */
  label?: string;
};

/** Spinner circular alineado con el acento del panel. */
export function Spinner({ className = "h-5 w-5", label = "Cargando" }: Props) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent ${className}`}
    />
  );
}
