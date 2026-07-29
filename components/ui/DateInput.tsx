"use client";

import type { InputHTMLAttributes, MouseEvent, FocusEvent } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function openPicker(el: HTMLInputElement) {
  try {
    el.showPicker?.();
  } catch {
    // showPicker puede fallar si no hay gesto de usuario o el browser no lo soporta
  }
}

/** Input de fecha que abre el calendario nativo al hacer clic o foco. */
export function DateInput({ className, onClick, onFocus, ...props }: Props) {
  return (
    <input
      {...props}
      type="date"
      className={className ?? "input"}
      onClick={(e: MouseEvent<HTMLInputElement>) => {
        openPicker(e.currentTarget);
        onClick?.(e);
      }}
      onFocus={(e: FocusEvent<HTMLInputElement>) => {
        openPicker(e.currentTarget);
        onFocus?.(e);
      }}
    />
  );
}
