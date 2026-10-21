#!/usr/bin/env node
/**
 * Cek A2 terhadap backend NYATA (tanpa mock jaringan) — frontend-contract-test
 * tidak menutupi kenyataan: alur baca A2 memanggil GET /diagnostic/* yang pada
 * build backend di workspace ini TIDAK terdaftar (lihat BLOCKER BACKEND di
 * LAPORAN_A2_LAB_RADIOLOGI.md).
 *
 * Yang diverifikasi di sini: saat backend tak menyediakan GET, UI harus
 *   (a) menampilkan state ERROR dengan tombol coba lagi (jujur),   → PASS
 *   (b) TIDAK menampilkan data palsu/karangan,                     → PASS
 *   (c) TIDAK crash (tanpa page error).                            → PASS
 * Bila salah satu terpenuhi → FAIL (bukan di-skip): ini bug frontend.
 *
 * Menjalankan:
 *   NEXT_PUBLIC_FEATURE_LAB=1 npx next build && npx next start -p 3312
 *   node e2e/lab/real-api-check.mjs     # butuh backend di NEXT_PUBLIC_API_URL
 */
import path from "node:path";
import { createReporter, ensureDir, launchBrowser, loadPlaywright } from "../lib/browser.mjs";
import { openA2Session } from "./a2-fixtures.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3312").replace(/\/+$/, "");
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");
const OUT = process.env.E2E_OUT_DIR ?? path.join("test-artifacts", "a2-e2e");

const reporter = createReporter({
  outDir: OUT,
  meta: { suite: "a2-real-api", mode: "real-backend", baseUrl: BASE, apiUrl: API, reportName: "a2-real-api-report.json" },
});
const { shot } = reporter;
function recordBool(id, name, v, detail = "") {
  return reporter.record(id, "real-backend-check", name, v === true ? "PASS" : v === false ? "FAIL" : v, detail);
}

/** Pastikan endpoint GET diagnostic benar-benar tidak terdaftar (bukti BLOCKER). */
async function probeRoutes() {
  const results = [];
  for (const p of [
    "/diagnostic/lab-orders",
    "/diagnostic/lab-results",
    "/diagnostic/radiology-orders",
    "/diagnostic/lab-orders/probe-id",
  ]) {
    try {
      const res = await fetch(`${API}${p}`);
      const body = await res.json().catch(() => ({}));
      const routeMissing = res.status === 404 && String(body.message ?? "").includes("Cannot GET");
      results.push({ path: p, status: res.status, routeMissing });
    } catch (e) {
      results.push({ path: p, status: 0, routeMissing: false, error: String(e?.message || e) });
    }
  }
  return results;
}

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });

  // 1) Bukti kontrak: GET diagnostic tidak terdaftar di backend yang hidup.
  const probes = await probeRoutes();
  const allMissing = probes.every((p) => p.routeMissing);
  recordBool(
    "REAL-01",
    "backend yang hidup tidak mendaftarkan GET /diagnostic/* (bukti BLOCKER BACKEND)",
    probes.length > 0 && allMissing,
    probes.map((p) => `${p.path}=${p.status}`).join(" ")
  );

  // 2) UI /lab TANPA mock: harus error-jujur, bukan data palsu, bukan crash.
  const pageErrors = [];
  try {
    const { context, page } = await openA2Session(browser, {
      base: BASE, role: "lab", label: "real-api", mock: false,
    });
    page.on("pageerror", (e) => pageErrors.push(e.message));
    try {
      await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("heading", { name: "Laboratorium" })
        .waitFor({ timeout: 20000 });

      const errorVisible = await page
        .getByRole("button", { name: "Coba lagi" })
        .isVisible()
        .catch(() => false);
      recordBool(
        "REAL-02",
        "GET tak tersedia → /lab menampilkan state error dengan tombol coba lagi (jujur)",
        errorVisible
      );

      const text = await page.evaluate(() => document.body.innerText);
      const fabricatesRows = /\d+ order ditemukan/.test(text) && !/0 order ditemukan/.test(text);
      recordBool(
        "REAL-03",
        "tanpa data dari API, UI TIDAK menampilkan baris order karangan",
        !fabricatesRows,
        fabricatesRows ? "ada baris order padahal API buntu" : "hanya state error/kosong"
      );
      await shot(page, "real-api-lab-error-1280x900");

      // 3) Halaman detail & radiologi juga tidak crash (tunggu elemen, bukan isVisible langsung).
      await page.goto(`${BASE}/lab/PROBE-ORDER-ID`, { waitUntil: "domcontentloaded" });
      const detailErr = await page
        .getByRole("heading", { name: "Gagal memuat detail order lab" })
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      recordBool("REAL-04", "detail order menampilkan error state saat GET tak tersedia", detailErr);

      await page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
      // /radiology punya dua jalur jujur: ErrorState (Gagal memuat) ATAU blok
      // peringatan per-sumber (Data radiologi tidak tersedia) — keduanya tanpa
      // baris order karangan.
      const radWarning = await page
        .getByText(/Data radiologi tidak tersedia|Gagal memuat order radiologi/)
        .first()
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      const radText = await page.evaluate(() => document.body.innerText);
      const radFabricated = /RO-\d+/.test(radText);
      recordBool(
        "REAL-05",
        "/radiology menampilkan pesan jujur (tanpa baris order karangan) saat GET tak tersedia",
        radWarning && !radFabricated,
        `pesanJujur=${radWarning} barisKarangan=${radFabricated}`
      );
      await shot(page, "real-api-radiology-1280x900");
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }

  recordBool("REAL-06", "tanpa page error tak terduga selama cek real-API", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
}

ensureDir(OUT);
main()
  .then(() => {
    const { file, summary } = reporter.write();
    console.log(`\nRingkasan: ${JSON.stringify(summary.totals)}`);
    console.log(`Laporan: ${file}`);
    process.exit(summary.totals.failed > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error("Cek real-API gagal berjalan:", e);
    process.exit(2);
  });
