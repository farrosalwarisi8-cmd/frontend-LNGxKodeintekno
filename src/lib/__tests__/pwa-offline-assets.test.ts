import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Level 1 — konsistensi aset PWA/offline (SoW 3.9.5).
 *
 * Test ini menjaga agar konfigurasi service worker, halaman fallback, manifest,
 * dan pengecualian proxy tidak "drift" saat salah satu bagian diubah:
 * - `public/sw.js` wajib mem-precache halaman /offline.
 * - /offline wajib publik (tidak boleh di-redirect ke /login saat offline).
 * - /sw.js wajib dikecualikan dari proxy agar bisa didaftarkan browser.
 * - Request API tidak boleh di-cache oleh service worker.
 */

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("aset PWA & mode offline", () => {
  it("service worker mem-precache /offline dan tidak meng-cache API", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain('const OFFLINE_URL = "/offline"');
    expect(sw).toContain("OFFLINE_URL,");
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    // Non-GET (mutasi klinis) tidak pernah disimpan di cache.
    expect(sw).toContain('if (request.method !== "GET") return;');
  });

  it("halaman fallback /offline ada dan tidak bergantung pada store/backend", () => {
    const page = read("app/offline/page.tsx");
    expect(page).not.toContain("useStore");
    expect(page).not.toContain("apiClient");
    expect(page).toContain("Anda sedang offline");
  });

  it("/offline publik dan /sw.js dilewatkan proxy", () => {
    expect(read("lib/public-paths.ts")).toContain('"/offline"');
    expect(read("proxy.ts")).toContain("sw.js");
  });

  it("service worker disajikan dengan header no-cache", () => {
    const config = read("next.config.ts");
    expect(config).toContain('source: "/sw.js"');
    expect(config).toContain("no-cache, no-store, must-revalidate");
  });

  it("manifest tetap terhubung di root layout", () => {
    expect(read("app/layout.tsx")).toContain('manifest: "/manifest.webmanifest"');
    expect(fs.existsSync(path.join(root, "public/manifest.webmanifest"))).toBe(true);
  });
});
