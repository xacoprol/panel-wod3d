"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barra superior fina al cambiar de ruta / query.
 * Da feedback inmediato en navegaciones client-side.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false);
  const first = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    setActive(true);
    // Completa la barra tras un momento (la página ya montó al cambiar key)
    const done = setTimeout(() => {
      setActive(false);
      hideTimer.current = setTimeout(() => setVisible(false), 280);
    }, 420);
    return () => {
      clearTimeout(done);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [key]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
      aria-hidden
    >
      <div
        className={`h-full origin-left bg-accent shadow-[0_0_8px_var(--accent)] transition-transform duration-300 ease-out ${
          active ? "nav-progress-run" : "scale-x-100 opacity-0"
        }`}
      />
    </div>
  );
}
