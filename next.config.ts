import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turn OFF typed routes for now (it’s what generates .next/dev/types validators)
  typedRoutes: false,
};

export default nextConfig;
