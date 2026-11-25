import type { NextConfig } from "next";

/**
 * Build production/staging tidak boleh memuat data seed klinis. Modul
 * `@/lib/demo-seed` dialias ke stub kosong agar `lib/seed.ts` tidak pernah
 * masuk ke bundel; pada `next dev` alias tidak dipakai sehingga demo tetap
 * berjalan dengan seed asli.
 */
const isProductionBuild = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  turbopack: isProductionBuild
    ? { resolveAlias: { "@/lib/demo-seed": "./lib/demo-seed.production.ts" } }
    : undefined,
  /**
   * Service worker (`public/sw.js`) harus selalu diambil ulang agar update
   * cache strategi tidak tertahan versi lama, dan tidak boleh di-cache agresif
   * oleh CDN/reverse proxy.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
