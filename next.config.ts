import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Turbopack/Webpack rompan el driver WS de Neon en Vercel
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],
  experimental: {
    // Logos + facturas de gasto (PDF/foto) vía server action
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
