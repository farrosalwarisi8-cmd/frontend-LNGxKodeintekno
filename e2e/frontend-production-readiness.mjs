/**
 * Frontend Production Readiness — Browser E2E (Playwright + system Chrome).
 *
 * Scope: FRONTEND ONLY. Tidak mengubah backend. Menjalankan production build
 * frontend (next start) terhadap backend lokal yang sedang berjalan.
 *
 * Menjalankan:
 *   node e2e/frontend-production-readiness.mjs
 *
 * Env:
 *   E2E_BASE_URL   (default http://127.0.0.1:3001)
 *   SEED_PASSWORD  (default KlinikLNG2026!)
 *
 * Playwright diambil dari node_modules milik repo backend (sibling) bila tidak
 * ada di repo frontend — sesuai batasan "gunakan tooling yang sudah tersedia".
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

function loadPlaywright() {
  const candidates = [];
  try {
    candidates.push(require.resolve("playwright-core"));
  } catch {
    /* not installed in frontend */
  }
  for (const dir of fs.readdirSync(".")) {
    if (/^kodein.*backend$/i.test(dir)) {
      candidates.push(path.resolve(dir, "node_modules", "playwright-core"));
    }
  }
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error("playwright-core tidak ditemukan (frontend maupun repo backend).");
}

const { chromium } = loadPlaywright();

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";
const PASSWORD = process.env.SEED_PASSWORD || "KlinikLNG2026!";
const OUT = "test-artifacts/frontend-readiness";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let consoleErrors = [];
let pageErrors = [];
let requestFailures = [];

function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} [${id}] ${name}${detail ? " — " + detail : ""}`);
}

async function withPage(context, fn) {
  const page = await context.newPage();
  const cErr = [];
  const pErr = [];
  const rFail = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") cErr.push(msg.text());
  });
  page.on("pageerror", (err) => pErr.push(err.message));
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.startsWith(BASE)) rFail.push(`${req.method()} ${u} — ${req.failure()?.errorText}`);
  });
  try {
    return await fn(page);
  } finally {
    consoleErrors.push(...cErr.map((e) => `[${fn.id || "?"}] ${e}`));
    pageErrors.push(...pErr.map((e) => `[${fn.id || "?"}] ${e}`));
    requestFailures.push(...rFail);
    await page.close();
  }
}

async function login(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(username);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

async function run(viewport, name, fn) {
  const context = await browser.newContext({ viewport, locale: "id-ID" });
  const label = `${name}@${viewport.width}x${viewport.height}`;
  try {
    await fn(context, label);
  } catch (e) {
    record(name, label, false, `EXCEPTION: ${e.message}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

// ---------------------------------------------------------------------------
// A. Route guard / auth boundary (unauthenticated)
// ---------------------------------------------------------------------------
await run({ width: 1280, height: 800 }, "guard-unauthenticated-redirect", async (ctx) => {
  await withPage(ctx, async (page) => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    record(
      "A1",
      "Protected route tanpa sesi redirect ke /login?from=",
      url.pathname === "/login" && url.searchParams.get("from") === "/dashboard",
      `url=${page.url()}`
    );
    const loginVisible = await page.getByRole("button", { name: "Masuk" }).first().isVisible().catch(() => false);
    record("A2", "Halaman /login dirender", loginVisible);
  });
});

await run({ width: 1280, height: 800 }, "public-verify-no-auth", async (ctx) => {
  await withPage(ctx, async (page) => {
    const res = await page.goto(`${BASE}/verify/sample-token`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());      record(
      "A3",
      "Route publik /verify/[token] dapat diakses tanpa sesi (tidak redirect ke /login)",
      url.pathname.startsWith("/verify") && (res?.status() ?? 0) < 500,
      `url=${page.url()} status=${res?.status()}`
    );
  });
});

// ---------------------------------------------------------------------------
// B. Login semua role utama + sidebar per permission
// ---------------------------------------------------------------------------
const ROLES = [
  { user: "admin", label: "System Administrator", expectDenied: null },
  { user: "dr.hendra", label: "Dokter OH", expectDenied: null },
  { user: "dr.klinik", label: "Dokter Klinik", expectDenied: "/master-data" },
  { user: "perawat", label: "Perawat", expectDenied: "/users" },
  { user: "apoteker", label: "Apoteker", expectDenied: "/employees" },
  { user: "lab.analis", label: "Lab", expectDenied: "/medicine/dispense" },
  { user: "hr.pic", label: "HR/PIC", expectDenied: "/audit-logs" },
  { user: "hse.officer", label: "HSE Officer", expectDenied: "/users" },
  { user: "hse.manager", label: "HSE Manager", expectDenied: null },
  { user: "manajemen", label: "Manajemen", expectDenied: "/employees" },
];

await run({ width: 1280, height: 800 }, "role-login-dashboard", async (ctx) => {
  for (const r of ROLES) {
    await withPage(ctx, async (page) => {
      await login(page, r.user);
      const onDashboard = page.url().includes("/dashboard");
      const sidebar = await page.locator('aside[aria-label="Navigasi utama"]').isVisible().catch(() => false);
      const h1 = await page.locator("h1").first().textContent().catch(() => "");
      record(
        `B-${r.user}`,
        `Login ${r.label} → dashboard + sidebar`,
        onDashboard && sidebar,
        `url=${page.url()} h1="${(h1 || "").trim()}"`
      );
      const denied = await page.getByText("Akses terbatas").isVisible().catch(() => false);
      record(`B-${r.user}-guard`, `${r.label} tidak melihat AccessDenied di dashboard`, !denied);
    });
  }
});

// ---------------------------------------------------------------------------
// C. Permission route → AccessDenied (tanpa konten terlindungi)
// ---------------------------------------------------------------------------
await run({ width: 1280, height: 800 }, "route-permission-denied", async (ctx) => {
  for (const r of ROLES.filter((x) => x.expectDenied)) {
    await withPage(ctx, async (page) => {
      await login(page, r.user);
      await page.goto(`${BASE}${r.expectDenied}`, { waitUntil: "domcontentloaded" });
      await page.getByText("Akses terbatas").waitFor({ timeout: 15000 }).catch(() => {});
      const denied = await page.getByText("Akses terbatas").isVisible().catch(() => false);
      record(`C-${r.user}`, `${r.label} → ${r.expectDenied} ditolak (AccessDenied)`, denied);
    });
  }
});

// ---------------------------------------------------------------------------
// D. Session restore setelah refresh + logout membersihkan sesi
// ---------------------------------------------------------------------------
await run({ width: 1280, height: 800 }, "session-restore-logout", async (ctx) => {
  await withPage(ctx, async (page) => {
    await login(page, "admin");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForURL((u) => u.pathname.includes("/dashboard"), { timeout: 15000 }).catch(() => {});
    record("D1", "Session restore setelah refresh (tetap di dashboard)", page.url().includes("/dashboard"), page.url());

    const tokens = await page.evaluate(() => ({
      access: Boolean(localStorage.getItem("kodein_token")),
      refresh: Boolean(localStorage.getItem("kodein_refresh_token")),
    }));
    record("D2", "Token disimpan di localStorage (kodein_token/refresh)", tokens.access && tokens.refresh);

    // Logout via user menu (tombol dengan aria-haspopup="menu" di topbar desktop)
    await page.locator('button[aria-haspopup="menu"]').first().click();
    await page.getByRole("menuitem", { name: "Keluar" }).click().catch(async () => {
      await page.getByText("Keluar").first().click();
    });
    await page.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
    record("D3", "Logout mengarahkan ke /login", page.url().includes("/login"), page.url());

    const after = await page.evaluate(() => ({
      access: localStorage.getItem("kodein_token"),
      cookie: document.cookie.includes("kodein-klinik-store"),
    }));
    record("D4", "Logout membersihkan token & session cookie", !after.access && !after.cookie, JSON.stringify(after));

    // Back button setelah logout tidak membuka konten terlindungi
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    const backUrl = new URL(page.url());
    record("D5", "Back setelah logout tidak membuka dashboard", backUrl.pathname.startsWith("/login"), page.url());
  });
});

// ---------------------------------------------------------------------------
// E. Mobile + tablet: bottom navigation & no horizontal overflow
// ---------------------------------------------------------------------------
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
];

for (const vp of VIEWPORTS) {
  await run(vp, "mobile-layout", async (ctx) => {
    await withPage(ctx, async (page) => {
      await login(page, "admin");
      await page.waitForLoadState("networkidle").catch(() => {});
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      record(`E-${vp.width}`, `Tanpa horizontal overflow @${vp.width}x${vp.height}`, overflow <= 2, `overflowPx=${overflow}`);
      const bottomNav = await page.locator('nav[aria-label="Navigasi bawah"]').isVisible().catch(() => false);
      record(`E-${vp.width}-nav`, `Bottom navigation tampil @${vp.width}`, bottomNav);
      await page.screenshot({ path: `${OUT}/dashboard-${vp.width}x${vp.height}.png`, fullPage: false });
    });
  });
}

// ---------------------------------------------------------------------------
// F. Screenshots evidence (desktop + AccessDenied)
// ---------------------------------------------------------------------------
await run({ width: 1440, height: 900 }, "screenshots", async (ctx) => {
  await withPage(ctx, async (page) => {
    await login(page, "admin");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: `${OUT}/dashboard-1440x900.png` });
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: `${OUT}/login.png` });
    await login(page, "hr.pic");
    await page.goto(`${BASE}/audit-logs`, { waitUntil: "domcontentloaded" });
    await page.getByText("Akses terbatas").waitFor({ timeout: 10000 }).catch(() => {});
    await page.screenshot({ path: `${OUT}/access-denied.png` });
    record("F1", "Screenshot evidence tersimpan", true);
  });
});

// ---------------------------------------------------------------------------
// H. Route smoke as System Administrator (semua modul utama)
// ---------------------------------------------------------------------------
const ADMIN_ROUTES = [
  "/dashboard",
  "/employees",
  "/people",
  "/people/new",
  "/mcu",
  "/mcu/new",
  "/mcu/review",
  "/visits",
  "/visits/queue",
  "/visits/new",
  "/medical-records",
  "/medicine",
  "/medicine/dispense",
  "/medicine/return",
  "/lab",
  "/da",
  "/certificates",
  "/reports",
  "/health-status",
  "/users",
  "/master-data",
  "/audit-logs",
  "/waiver",
  "/emergency",
  "/my/profile",
];

// Route yang SENGAJA ditolak untuk admin (permission klinis khusus dokter-oh,
// ditegakkan oleh lib/rbac.ts + src/lib/__tests__/rbac.test.ts).
const ADMIN_DENIED_BY_DESIGN = ["/mcu/review", "/certificates"];

await run({ width: 1280, height: 800 }, "admin-route-smoke", async (ctx) => {
  await withPage(ctx, async (page) => {
    await login(page, "admin");
    for (const route of ADMIN_ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const denied = await page.getByText("Akses terbatas").isVisible().catch(() => false);
      const hasMain = await page.locator("main").isVisible().catch(() => false);
      const intendDenied = ADMIN_DENIED_BY_DESIGN.includes(route);
      const ok = intendDenied ? denied === true : !denied && hasMain;
      record(
        `H${route}`,
        intendDenied
          ? `Admin ditolak ${route} (permission klinis khusus dokter-oh, sesuai registry)`
          : `Admin dapat membuka ${route} (tanpa AccessDenied, layout utama tampil)`,
        ok,
        `denied=${denied} main=${hasMain}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// G. Error states: invalid login + offline indicator
// ---------------------------------------------------------------------------
await run({ width: 1280, height: 800 }, "error-states", async (ctx) => {
  await withPage(ctx, async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: "Masuk" }).first().click();
    await page.waitForTimeout(1500);
    const errText = await page
      .locator(".text-danger-700")
      .first()
      .textContent({ timeout: 10000 })
      .catch(() => "");
    record(
      "G1",
      "Login gagal menampilkan pesan error inline (tanpa reload halaman)",
      Boolean(errText && errText.trim()),
      (errText || "").trim()
    );
  });

  await withPage(ctx, async (page) => {
    await login(page, "admin");
    await ctx.setOffline(true);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    const offline = await page.getByText("Offline", { exact: false }).first().isVisible().catch(() => false);
    record("G2", "Indikator offline tampil saat browser offline", offline);
    await ctx.setOffline(false);
  });
});

await browser.close();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
const summary = {
  base: BASE,
  viewports: ["1280x800", "1440x900", "390x844", "360x800", "768x1024"],
  total: results.length,
  passed,
  failed,
  consoleErrors,
  pageErrors,
  requestFailures,
  results,
};
fs.writeFileSync(path.join(OUT, "browser-e2e-report.json"), JSON.stringify(summary, null, 2));

console.log("\n== BROWSER E2E SUMMARY ==");
console.log(`total=${results.length} passed=${passed} failed=${failed}`);
console.log(`console_errors=${consoleErrors.length} page_errors=${pageErrors.length} request_failures=${requestFailures.length}`);
if (consoleErrors.length) console.log("consoleErrors:", consoleErrors.slice(0, 10));
if (pageErrors.length) console.log("pageErrors:", pageErrors.slice(0, 10));
console.log(`report: ${OUT}/browser-e2e-report.json`);

process.exit(failed > 0 ? 1 : 0);
