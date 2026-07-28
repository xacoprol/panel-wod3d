export const DEFAULT_THEME = {
  themeBg: "#f3efe6",
  themeBgElevated: "#faf7f0",
  themeInk: "#1a2332",
  themeInkMuted: "#5c6b7a",
  themeLine: "#d4cbb8",
  themeAccent: "#0d6e6e",
  themeAccentHover: "#0a5858",
  themeAccentSoft: "#e0f0ef",
  themeSidebar: "#1a2332",
  themeSidebarText: "#e8e4db",
};

export type ThemeColors = {
  themeBg: string;
  themeBgElevated: string;
  themeInk: string;
  themeInkMuted: string;
  themeLine: string;
  themeAccent: string;
  themeAccentHover: string;
  themeAccentSoft: string;
  themeSidebar: string;
  themeSidebarText: string;
};

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function sanitizeHex(value: string, fallback: string): string {
  const v = value.trim();
  return isHexColor(v) ? v : fallback;
}

export function themeToCssVars(
  theme: Partial<ThemeColors> | null | undefined
): Record<string, string> {
  const t = { ...DEFAULT_THEME, ...theme };
  return {
    "--bg": t.themeBg,
    "--bg-elevated": t.themeBgElevated,
    "--ink": t.themeInk,
    "--ink-muted": t.themeInkMuted,
    "--line": t.themeLine,
    "--accent": t.themeAccent,
    "--accent-hover": t.themeAccentHover,
    "--accent-soft": t.themeAccentSoft,
    "--sidebar": t.themeSidebar,
    "--sidebar-text": t.themeSidebarText,
  };
}

export const THEME_FIELDS: {
  key: keyof ThemeColors;
  label: string;
  hint?: string;
}[] = [
  { key: "themeBg", label: "Fondo", hint: "Color de página" },
  { key: "themeBgElevated", label: "Superficies", hint: "Tarjetas e inputs" },
  { key: "themeInk", label: "Texto", hint: "Títulos y cuerpo" },
  { key: "themeInkMuted", label: "Texto secundario" },
  { key: "themeLine", label: "Bordes / líneas" },
  { key: "themeAccent", label: "Acento", hint: "Botones y enlaces" },
  { key: "themeAccentHover", label: "Acento (hover)" },
  { key: "themeAccentSoft", label: "Acento suave", hint: "Fondos de selección" },
  { key: "themeSidebar", label: "Sidebar" },
  { key: "themeSidebarText", label: "Texto sidebar" },
];
