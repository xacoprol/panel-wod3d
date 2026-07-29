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
    // Logos en base64 vía server action (~1.5 MB archivo → ~2 MB body)
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
