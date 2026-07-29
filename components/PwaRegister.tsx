"use client";

import { useEffect } from "react";

/** Registra el service worker para poder “Instalar app” / Add to Dock. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silenciar en dev / entornos sin SW
    });
  }, []);

  return null;
}
