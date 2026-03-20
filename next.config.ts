import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.plantuml.com",
      },
    ],
  },
};

export default nextConfig;
