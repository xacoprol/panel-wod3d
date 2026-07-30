export const DEFAULT_THEME = {
  themeBg: "#F3F1F8",
  themeBgElevated: "#FFFFFF",
  themeInk: "#1A1528",
  themeInkMuted: "#6B6578",
  themeLine: "#E2DEEA",
  themeAccent: "#7B2CFE",
  themeAccentHover: "#6518E0",
  themeAccentSoft: "#EFE8FF",
  themeSidebar: "#17122A",
  themeSidebarText: "#EDE9F6",
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
