import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ThemeStyles } from "@/components/ThemeStyles";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "VEXO — Panel de facturación",
  description: "Gestión de clientes, presupuestos y facturas",
};

/** Evita prerender estático que exige DATABASE_URL en el build de Vercel */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${dmSans.variable} ${jetbrains.variable} h-full`}>
      <body className="min-h-full bg-paper antialiased">
        <ThemeStyles />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
