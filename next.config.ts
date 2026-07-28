import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que Turbopack/Webpack rompan el driver WS de Neon en Vercel
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "ws",
  ],
};

export default nextConfig;
