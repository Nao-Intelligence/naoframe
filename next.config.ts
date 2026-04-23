import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Wireframe-Bundle uploads can be large; the action itself caps at 100 MB.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
