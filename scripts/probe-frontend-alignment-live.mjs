/**
 * Probe verifikasi selarasan frontend ↔ backend (Fase 6).
 *
 * Membuktikan lewat browser nyata (dev server + backend hidup) bahwa dua
 * perbaikan selarasan benar-benar bekerja:
 *
 *  1. ScopeSelector (admin/manajemen/hse) — `GET /master-data/sites` 404 di
 *     backend, jadi kini fallback ke `GET /iam/users` → `user_roles[].site`.
 *     Kriteria: opsi site TETAP muncul (bukan selector kosong yang terkunci).
 *
 *  2. /medicine/return — `GET /pharmacy/dispensing/history` 404. Kriteria:
 *     halaman TIDAK ErrorState; inventory tetap tampil; empty state menjelaskan
 *     riwayat belum tersedia; tidak ada pageerror.
 *
 * Jalankan dengan dev server (3001) + backend (3000) aktif:
 *   node scripts/probe-frontend-alignment-live.mjs
 * Artefak: test-artifacts/frontend-alignment-live/
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const API = (process.env.E2E_API_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/frontend-alignment-live");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function record(id, name, status, detail = "") {
  results.push({ id, name, status, detail });
  const icon =
    status === "PASS" ? "\u2713" : status === "FAIL" ? "\u2717" : status === "GAP" ? "\u25c7" : "\u25b3";
  console.log(`${icon} [${id}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
}
const shoot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});

async function login(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const u = page.getByLabel("Username");
  const p = page.getByLabel("Password");
  await u.waitFor({ state: "visible", timeout: 30000 });
  await u.fill(username);
  await p.fill(PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).first().click();
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  } catch {
    const body = await page.locator("body").innerText().catch(() => "");
    if (!/Verifikasi MFA|Two-Factor Authentication/i.test(body)) {
      throw new Error(`Login ${username} gagal: ${body.slice(0, 160).replace(/\n+/g, " | ")}`);
    }
    // Role admin/dokter-oh wajib MFA. Backend environment demo menerima kode
    // bypass `123456` (dijelaskan di halaman verifikasi itu sendiri) — ini alur
    // login UI yang resmi, bukan jalur pintas.
    await page.getByLabel("Kode MFA").fill(process.env.E2E_MFA_CODE ?? "123456");
    await page.getByRole("button", { name: "Verifikasi" }).first().click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
}

/** Rekam request /api/v1 (path + status) + pageerror selama satu kunjungan. */
async function visit(page, state, pathname) {
  state.api.length = 0;
  state.errors.length = 0;
  await page.goto(`${BASE}${pathname}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  return page.locator("body").innerText().catch(() => "");
}
const called = (state, pathname) =>
  state.api.filter((r) => r.path === pathname || r.path.startsWith(`${pathname}?`));
const FULL_ERROR = /Gagal memuat|Terjadi kesalahan saat memuat/i;

async function openSession(context, user) {
  const page = await context.newPage();
  const state = { api: [], errors: [] };
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/v1/")) {
      state.api.push({
        path: new URL(u).pathname.replace("/api/v1", "") + new URL(u).search,
        status: res.status(),
      });
    }
  });
  page.on("pageerror", (e) => state.errors.push(e.message));
  await login(page, user);
  record(`S-${user}`, `Login ${user} (sesi backend nyata)`, "PASS", "");
  return { page, state };
}

async function main() {
  const playwright = loadPlaywright();
  const { browser, launch } = await launchBrowser(playwright);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  console.log(`[selaras] browser=${JSON.stringify(launch)} frontend=${BASE} backend=${API}\n`);

  // ======================================================================
  // 1. ScopeSelector — admin, sumber cadangan /iam/users
  // ======================================================================
  {
    const { page, state } = await openSession(context, "admin");
    await visit(page, state, "/dashboard");
    await shoot(page, "admin-dashboard-scope");

    const sel = page.getByLabel("Pilih scope site");
    const visible = await sel.isVisible().catch(() => false);
    record(
      "A1",
      "ScopeSelector tampil untuk admin (role multi-site)",
      visible ? "PASS" : "FAIL",
      visible ? "" : "selector tidak dirender"
    );

    if (visible) {
      // Backend lama (master-data) sengaja dicoba dulu — buktikan memang 404
      // sehingga fallback /iam/users bukan sekadar asumsi.
      const masterCalls = called(state, "/master-data/sites");
      record(
        "A2",
        "GET /master-data/sites memang ditolak backend (404) → sumber utama tidak tersedia",
        masterCalls.length > 0 && masterCalls.every((c) => c.status === 404) ? "GAP" : "PASS",
        `status=${masterCalls.map((c) => c.status).join(",") || "tidak dipanggil"}`
      );

      const iamCalls = called(state, "/iam/users");
      record(
        "A3",
        "fallback GET /iam/users dipanggil untuk daftar site",
        iamCalls.length > 0 && iamCalls.some((c) => c.status === 200) ? "PASS" : "FAIL",
        `calls=${iamCalls.map((c) => c.status).join(",") || "none"}`
      );

      const opts = await sel
        .locator("option")
        .evaluateAll((els) => els.map((e) => (e.textContent ?? "").trim()))
        .catch(() => []);
      const siteOpts = opts.filter((o) => o && !/^Semua site$/i.test(o));
      record(
        "A4",
        "Selector memuat opsi site dari backend (bukan kosong/terkunci)",
        siteOpts.length > 0 ? "PASS" : "FAIL",
        `opsi=${siteOpts.length} :: ${siteOpts.join(" | ")}`
      );

      if (siteOpts.length > 0) {
        // Pilih site pertama: baris tersinkron harus terfilter ke scope itu.
        const firstValue = await sel
          .locator("option")
          .nth(1)
          .getAttribute("value")
          .catch(() => null);
        if (firstValue) {
          await sel.selectOption(firstValue);
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(2500);
          const after = await page.locator("body").innerText().catch(() => "");
          const label = (siteOpts[0] ?? "").split(" (")[0];
          record(
            "A5",
            "Memilih scope site → label terpilih terlihat & tidak ada pageerror",
            after.includes(label) && state.errors.length === 0 ? "PASS" : "FAIL",
            `label="${label}" errors=${state.errors.join(" | ") || "0"}`
          );
          await shoot(page, "admin-scope-terpilih");
        }
      }
    }
    await page.close();
  }

  // ======================================================================
  // 2. /medicine/return — riwayat 404, inventory tetap tampil
  // ======================================================================
  {
    const { page, state } = await openSession(context, "apoteker");
    const body = await visit(page, state, "/medicine/return");
    await shoot(page, "apoteker-medicine-return");

    const historyCall = called(state, "/pharmacy/dispensing/history")[0];
    record(
      "B1",
      "GET /pharmacy/dispensing/history ditolak backend (404)",
      historyCall && historyCall.status === 404 ? "GAP" : "PASS",
      `status=${historyCall?.status ?? "tidak dipanggil"}`
    );

    const inventoryCall = called(state, "/pharmacy/inventory")[0];
    record(
      "B2",
      "inventory tetap dimuat dari backend (GET /pharmacy/inventory → 200)",
      inventoryCall && inventoryCall.status === 200 ? "PASS" : "FAIL",
      `status=${inventoryCall?.status ?? "none"}`
    );

    record(
      "B3",
      "/medicine/return TIDAK ErrorState penuh (halaman tetap bisa dipakai)",
      !FULL_ERROR.test(body) ? "PASS" : "FAIL",
      FULL_ERROR.test(body) ? "ErrorState 'Gagal memuat' masih tampil" : "tanpa ErrorState penuh"
    );

    record(
      "B4",
      "empty state menjelaskan riwayat dispensing belum tersedia",
      /riwayat dispensing belum tersedia/i.test(body) ? "PASS" : "FAIL",
      /riwayat dispensing belum tersedia/i.test(body) ? "pesan tepat sasaran" : "pesan tidak ditemukan"
    );

    record(
      "B5",
      "tanpa pageerror (tidak ada crash runtime)",
      state.errors.length === 0 ? "PASS" : "FAIL",
      state.errors.join(" | ") || "bersih"
    );

    const hasInventoryLabel = /Inventory Saat Ini/i.test(body);
    record(
      "B6",
      "seksi inventory dirender dari data backend",
      hasInventoryLabel ? "PASS" : "FAIL",
      hasInventoryLabel ? "seksi tampil" : "seksi tidak ada"
    );
    await page.close();
  }

  await browser.close();
  return finish();
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL");
  const gaps = results.filter((r) => r.status === "GAP");
  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    api: API,
    totals: {
      total: results.length,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: failed.length,
      gaps: gaps.length,
    },
    results,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\nRINGKASAN SELARAS (live): total=${summary.totals.total} pass=${summary.totals.passed} fail=${summary.totals.failed} gap-backend=${summary.totals.gaps}`
  );
  if (failed.length > 0) console.log(`FAIL: ${failed.map((f) => f.id).join(", ")}`);
  console.log(`Artefak: ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  record("X99", "Probe selesai tanpa error fatal", "FAIL", e?.message ?? String(e));
  process.exit(1);
});
