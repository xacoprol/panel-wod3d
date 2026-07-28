import { prisma } from "@/lib/prisma";
import { themeToCssVars, type ThemeColors } from "@/lib/theme";

export async function ThemeStyles() {
  const settings = await prisma.companySettings.findFirst();
  const vars = themeToCssVars(
    settings
      ? ({
          themeBg: settings.themeBg,
          themeBgElevated: settings.themeBgElevated,
          themeInk: settings.themeInk,
          themeInkMuted: settings.themeInkMuted,
          themeLine: settings.themeLine,
          themeAccent: settings.themeAccent,
          themeAccentHover: settings.themeAccentHover,
          themeAccentSoft: settings.themeAccentSoft,
          themeSidebar: settings.themeSidebar,
          themeSidebarText: settings.themeSidebarText,
        } satisfies ThemeColors)
      : null
  );

  const css = `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
