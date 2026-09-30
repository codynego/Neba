import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  devIndicators: false,
  distDir: process.env.NEBA_BUILD_DIR || ".next",
  async headers() {
    const privateRoutes = ["dashboard", "activity", "messages", "notifications", "profile", "members", "u", "verify", "safety", "tasks", "offers", "login", "register"];
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
      ...privateRoutes.map((path) => ({ source: `/${path}/:path*`, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] })),
    ];
  },
};
export default nextConfig;
