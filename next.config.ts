import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mfflhbsveqnoytmfyosn.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        // El link publico del chat ahora es /chat (antes /demo-whatsapp).
        // Se deja esta redireccion para que ningun link viejo repartido
        // (anuncios, WhatsApp, etc.) se rompa.
        source: "/demo-whatsapp",
        destination: "/chat",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
