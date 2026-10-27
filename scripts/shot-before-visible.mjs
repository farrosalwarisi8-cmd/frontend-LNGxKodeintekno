#!/usr/bin/env node
/**
 * Screenshot "sebelum" rebrand visible (Langkah 0).
 *
 * Memotret login, halaman publik (consent/verify butuh token — pakai token
 * sintetis), shell (dashboard), dan satu halaman dalam (visits) pada
 * 360/768/1280 px, light + dark, dengan API distub (data sintetis).
 * Menyimpan ke docs/ui-rebrand/before-visible/{360,768,1280}/[-dark].png.
 *
 * Data sintetis saja — tidak ada kredensial/data pasien nyata.
 * Env: SHOT_BASE_URL default http://localhost:3311 (next start),
 *      SHOT_OUT_DIR default docs/ui-rebrand/before-visible (relatif ke ROOT).
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright, ensureDir } from "../e2e/lib/browser.mjs";

const BASE = (process.env.SHOT_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");
const OUT = path.resolve(
  process.env.SHOT_OUT_DIR ?? path.join("docs", "ui-rebrand", "before-visible")
);

const SEED_USER = {
  id: "u-shot",
  username: "admin.shot",
  name: "Admin Shot",
  password: "",
  role: "admin",
  title: "System Administrator",
  mfaEnabled: false,
  preferredLanguage: "id",
};

const EMPTY_ENVELOPE = JSON.stringify({
  success: true,
  statusCode: 200,
  data: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
  timestamp: "2026-10-27T00:00:00.000Z",
});

const VIEWPORTS = [
  { w: 360, h: 800, dir: "360" },
  { w: 768, h: 1024, dir: "768" },
  { w: 1280, h: 900, dir: "1280" },
];

const PAGES = [
  { name: "login", path: "/login", auth: false },
  { name: "verify", path: "/verify/SINTETIS-TOKEN-123", auth: false },
  { name: "consent", path: "/public/consent/SINTETIS-TOKEN-123", auth: false },
  { name: "dashboard", path: "/dashboard", auth: true },
  { name: "visits", path: "/visits", auth: true },
];

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  try {
    for (const vp of VIEWPORTS) {
      for (const dark of [false, true]) {
        const context = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          colorScheme: dark ? "dark" : "light",
        });
        if (dark) {
          // Paksa kelas .dark — next-themes belum terpasang, token memakai .dark.
          await context.addInitScript(() => {
            document.documentElement.classList.add("dark");
          });
        }
        await context.addInitScript(([user]) => {
          localStorage.setItem(
            "kodein-klinik-store",
            JSON.stringify({ state: { currentUserId: user.id, users: [user] }, version: 0 })
          );
          localStorage.setItem(
            "emr-demo-role",
            JSON.stringify({ state: { role: "SYSTEM_ADMIN", enabled: false }, version: 0 })
          );
        }, [SEED_USER]);
        await context.addCookies([
          {
            name: "kodein-klinik-store",
            value: encodeURIComponent(JSON.stringify({ state: { currentUserId: SEED_USER.id } })),
            url: BASE,
          },
        ]);
        const page = await context.newPage();
        await page.route("**/api/v1/**", (route) =>
          route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ENVELOPE })
        );
        for (const p of PAGES) {
          const dir = path.join(OUT, vp.dir);
          ensureDir(dir);
          const file = path.join(dir, `${p.name}${dark ? "-dark" : ""}.png`);
          try {
            await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
            await page.waitForTimeout(1200);
            await page.screenshot({ path: file, fullPage: true });
            console.log(`ok ${vp.dir}/${p.name}${dark ? "-dark" : ""}`);
          } catch (e) {
            console.log(`GAGAL ${vp.dir}/${p.name}${dark ? "-dark" : ""}: ${String(e).slice(0, 160)}`);
          }
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
