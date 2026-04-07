import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.dmm.co.jp",
      },
      {
        protocol: "https",
        hostname: "**.dmm.com",
      },
    ],
  },
};

export default nextConfig;
