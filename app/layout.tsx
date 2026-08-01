import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { ThemeStyles } from "@/components/ThemeStyles";
import { PwaRegister } from "@/components/PwaRegister";
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
  title: "Vexo — Panel de facturación",
  description: "Gestión de clientes, presupuestos y facturas",
  applicationName: "Vexo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vexo",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#7B2CFE",
  colorScheme: "dark light",
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
      <body className="min-h-dvh bg-paper antialiased">
        <ThemeStyles />
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
