import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  devIndicators: false,
  distDir: process.env.NEBA_BUILD_DIR || ".next",
};
export default nextConfig;
