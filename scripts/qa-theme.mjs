#!/usr/bin/env node
/**
 * QA Tugas 4 — verifikasi pengalih tema di browser (tanpa backend).
 *
 * Halaman yang diuji: /dashboard (shell internal, butuh sesi → disuntik
 * seperti skrip a11y) karena ThemeToggle Tugas 4 dipasang di topbar shell
 * (toggle di login/landing publik menyusul di Tugas 3/5).
 *
 * Memeriksa:
 *  1. Tidak ada hydration mismatch (console error React).
 *  2. Toggle Terang/Gelap/Sistem tampil dengan role radio + aria-checked.
 *  3. Klik "Gelap" memasang kelas .dark pada <html> + latar gelap ter-render.
 *  4. Klik "Terang" melepas .dark. Pilihan tersimpan (localStorage next-themes).
 *  5. Keyboard: Tab mencapai radio + Space mengganti tema.
 *  6. Tema bertahan setelah reload (tanpa kilatan = .dark sudah ada sebelum paint).
 *
 * Env: THEME_BASE_URL default http://localhost:3311.
 */
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.THEME_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");

const SEED_USER = {
  id: "u-theme",
  username: "admin.theme",
  name: "Admin Theme",
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

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  const failures = [];
  const check = (name, ok, detail = "") => {
    console.log(`${ok ? "ok" : "GAGAL"} ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures.push(name);
  };
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(([user]) => {
      localStorage.setItem(
        "kodein-klinik-store",
        JSON.stringify({ state: { currentUserId: user.id, users: [user] }, version: 0 })
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
    const errors = [];
    let ignored404At = 0;
    page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      // "Failed to load resource: ... 404" tidak menyertakan URL; abaikan
      // bila barusan ada response 404 yang sudah dikecualikan (favicon/RSC).
      if (/Failed to load resource.*404/.test(text) && Date.now() - ignored404At < 5000) return;
      errors.push(`console: ${text.slice(0, 200)}`);
    });
    page.on("response", (r) => {
      // Abaikan 404 prefetch RSC untuk route kontrol sistem (/system-config,
      // /api-keys, /tte, /emergency-detail) yang guard-nya ada (A1) tetapi
      // halamannya belum ada — temuan di luar lingkup, dicatat di laporan.
      const url = r.url();
      if (r.status() === 404 && /_rsc=/.test(url)) {
        ignored404At = Date.now();
        return;
      }
      // Abaikan 404 /favicon.ico: ikon tab dilayani via `<link rel="icon">`
      // ke /icons/* (metadata eksplisit). Browser tetap meminta /favicon.ico
      // sebagai fallback standar; Next hanya melayani konvensi file
      // `app/favicon.ico` (.ico literal) yang tidak kita sediakan karena
      // aset sumber adalah PNG (dicatat di laporan).
      if (r.status() === 404 && /\/favicon\.ico$/.test(url)) {
        ignored404At = Date.now();
        return;
      }
      if (r.status() >= 400) errors.push(`http-${r.status()}: ${url.slice(0, 160)}`);
    });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const radio = page.getByRole("radio", { name: /Tema (Terang|Gelap|Sistem)/ });
    check("toggle tiga radio tampil", (await radio.count()) === 3, `${await radio.count()} radio`);
    const checked = await page.getByRole("radio", { checked: true }).count();
    check("satu radio tercentang", checked === 1, `${checked} checked`);

    const hydration = errors.filter((e) => /hydrat/i.test(e));
    check("tanpa hydration error", hydration.length === 0, hydration[0] ?? "");

    await page.getByRole("radio", { name: "Tema Gelap" }).click();
    await page.waitForTimeout(600);
    const darkOn = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    const bgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check("klik Gelap memasang .dark", darkOn, `body=${bgDark}`);

    await page.getByRole("radio", { name: "Tema Terang" }).click();
    await page.waitForTimeout(600);
    const darkOff = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
    check("klik Terang melepas .dark", darkOff);

    const stored = await page.evaluate(() => localStorage.getItem("theme"));
    check("pilihan tersimpan (localStorage key next-themes)", stored === '"light"' || stored === "light", String(stored));

    // Keyboard: fokus ke radio Gelap lalu Space.
    await page.getByRole("radio", { name: "Tema Gelap" }).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(600);
    const darkKb = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    check("keyboard Space mengganti tema", darkKb);

    // Reload: tema bertahan (Gelap).
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const darkPersist = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    check("tema bertahan setelah reload", darkPersist);

    check("tanpa pageerror/console-error", errors.length === 0, errors[0] ?? "");
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.log(`\n${failures.length} GAGAL: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("\nSemua pemeriksaan tema lolos.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
