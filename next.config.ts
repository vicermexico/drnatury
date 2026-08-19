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
};
export default nextConfig;
