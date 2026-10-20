#!/usr/bin/env node
/**
 * E2E Fase A2 — alur Radiologi (frontend-contract-test, TANPA backend).
 *
 * Cakupan (Tugas 7 & 9):
 *   RAD-01  daftar order radiologi + pilih order
 *   RAD-02  form laporan (temuan/kesimpulan): validasi, draf, kirim, status
 *   RAD-03  laporan terkirim/terverifikasi tampil read-only (koreksi=addendum)
 *   RAD-04  role tanpa write-radiology-report ditolak (route + menu)
 *   RAD-05  lampiran dinonaktif dengan alasan jujur (BLOCKER BACKEND upload)
 *   RAD-06  axe pada halaman /radiology
 *
 * Menjalankan (dengan feature flag AKTIF):
 *   NEXT_PUBLIC_FEATURE_LAB=1 npx next start -p 3312
 *   E2E_BASE_URL=http://localhost:3312 node e2e/radiology/radiology-workflows.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createReporter, ensureDir, launchBrowser, loadPlaywright } from "../lib/browser.mjs";
import { openA2Session } from "../lab/a2-fixtures.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3312").replace(/\/+$/, "");
const OUT = process.env.E2E_OUT_DIR ?? path.join("test-artifacts", "a2-e2e");

const axeSource = fs.readFileSync(
  path.join(path.dirname(require.resolve("axe-core/package.json")), "axe.min.js"),
  "utf8"
);

const reporter = createReporter({
  outDir: OUT,
  meta: { suite: "a2-radiology", mode: "frontend-contract-test", baseUrl: BASE, reportName: "a2-radiology-report.json" },
});
const { shot } = reporter;

/** Bentuk record() yang menerima boolean (true=PASS, false=FAIL) sebagai status. */
function record(id, group, name, st, detail = "", extra = {}) {
  const normalized = st === true ? "PASS" : st === false ? "FAIL" : st;
  return reporter.record(id, group, name, normalized, detail, extra);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  try {
    await radiologyListAndReport(browser);
    await radiologyReadonlyAndBlockers(browser);
    await radiologyRbac(browser);
    await radiologyA11y(browser);
  } finally {
    await browser.close();
  }
}

/** RAD-01 + RAD-02: daftar order, susun laporan, validasi, draf, kirim. */
async function radiologyListAndReport(browser) {
  const { context, page, calls, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "rad-list",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Radiologi" }).waitFor({ timeout: 20000 });
    const body = await bodyText(page);
    record(
      "RAD-01-01",
      "frontend-contract-test",
      "daftar order radiologi tampil terpisah dari alur lab",
      body.includes("RO-100") && body.includes("RO-101") && body.includes("Menunggu pemeriksaan"),
      "order + status teks tampil"
    );
    await shot(page, "radiology-list-1280x900");

    // Pilih order → form laporan muncul.
    await page.getByRole("button", { name: "Buka laporan" }).first().click();
    await page.getByRole("heading", { name: "Susun laporan radiologi" }).waitFor({ timeout: 15000 });
    record("RAD-01-02", "frontend-contract-test", "memilih order membuka form laporan radiologi", true);

    // Lampiran: field files butuh objectKey dari endpoint upload yang belum ada.
    const formBody = await bodyText(page);
    record(
      "RAD-05-01",
      "frontend-contract-test",
      "lampiran dinonaktif dengan alasan endpoint upload belum ada (BLOCKER BACKEND)",
      formBody.includes("BLOCKER BACKEND"),
      "alasan jujur tampil di form laporan"
    );

    // Validasi: kirim tanpa isi → ditolak.
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await page.getByText("Temuan dan kesimpulan wajib diisi.").waitFor({ timeout: 10000 });
    record("RAD-02-01", "frontend-contract-test", "kirim kosong ditolak dengan pesan jelas", true);

    // Draf lokal: isi temuan, simpan draf, muat ulang, draf pulih.
    await page.getByLabel("Temuan (findings)").fill("Nodul kecil di lobus kanan bawah.");
    await page.getByRole("button", { name: "Simpan draf" }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Radiologi" }).waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "Buka laporan" }).first().click();
    await page.getByRole("heading", { name: "Susun laporan radiologi" }).waitFor({ timeout: 15000 });
    const restored = await page.getByLabel("Temuan (findings)").inputValue();
    record(
      "RAD-02-02",
      "frontend-contract-test",
      "draf laporan tersimpan lokal dan dipulihkan setelah muat ulang",
      restored.includes("Nodul kecil"),
      `restored=${restored.slice(0, 40)}`
    );

    // Lengkapi & kirim.
    await page.getByLabel("Kesimpulan (impression)").fill("Gambaran pneumonia ringan, kontrol 2 minggu.");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/diagnostic/radiology-results") && r.request().method() === "POST", {
        timeout: 15000,
      }),
      page.getByRole("button", { name: "Kirim laporan" }).click(),
    ]);
    await page.getByText("Laporan terkirim").waitFor({ timeout: 15000 });
    const post = calls.find((c) => c.method === "POST" && c.path.endsWith("/diagnostic/radiology-results"));
    record(
      "RAD-02-03",
      "frontend-contract-test",
      "kirim laporan memakai endpoint kontrak dengan findings + impression",
      post?.body?.radiologyOrderId === "RO-100" &&
        typeof post?.body?.findings === "string" &&
        typeof post?.body?.impression === "string",
      `payload=${JSON.stringify({ id: post?.body?.radiologyOrderId })}`
    );
    await shot(page, "radiology-submitted-1280x900");
  } finally {
    await context.close();
  }
}

/** RAD-03 + RAD-05: read-only setelah tersimpan/terverifikasi + lampiran blocker. */
async function radiologyReadonlyAndBlockers(browser) {
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "rad-readonly",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Radiologi" }).waitFor({ timeout: 20000 });

    // Order RO-101 sudah punya hasil terverifikasi (verified_at terisi).
    await page.getByRole("button", { name: "Buka laporan" }).nth(1).click();
    await page.getByText("Laporan tersimpan").waitFor({ timeout: 15000 });
    const body = await bodyText(page);
    record(
      "RAD-03-01",
      "frontend-contract-test",
      "hasil terverifikasi tampil read-only dengan status menunggu tanda tangan",
      body.includes("Terverifikasi, menunggu tanda tangan"),
      "status batas akhir A2"
    );
    record(
      "RAD-03-02",
      "frontend-contract-test",
      "laporan read-only menjelaskan koreksi lewat addendum (Fase A4)",
      /koreksi dilakukan lewat addendum/i.test(body),
      "penjelasan addendum tampil"
    );
    const editable = await page.getByLabel("Temuan (findings)").count();
    record(
      "RAD-03-03",
      "frontend-contract-test",
      "form edit tidak dirender untuk laporan tersimpan",
      editable === 0,
      `textareaEdit=${editable}`
    );
    await shot(page, "radiology-readonly-1280x900");
  } finally {
    await context.close();
  }
}

/** RAD-04: RBAC radiologi vs analis-lain. */
async function radiologyRbac(browser) {
  // Apoteker: TANPA write-radiology-report → route ditolak & menu tidak tampil.
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "apoteker", label: "rad-rbac",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Akses Ditolak" }).waitFor({ timeout: 15000 });
    record("RAD-04-01", "frontend-contract-test", "role tanpa write-radiology-report ditolak di route /radiology", true);
    await shot(page, "radiology-denied-1280x900");

    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    const radLink = await page.getByRole("link", { name: "Radiologi", exact: true }).count();
    record(
      "RAD-04-02",
      "frontend-contract-test",
      'menu "Radiologi" tidak tampil untuk role tanpa izin',
      radLink === 0,
      `linkCount=${radLink}`
    );
  } finally {
    await context.close();
  }
}

/** RAD-06: axe. */
async function radiologyA11y(browser) {
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "rad-a11y",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
    // Tunggu state nyata halaman (h1 Radiologi) — tanpa sleep tetap.
    await page.getByRole("heading", { name: "Radiologi" }).waitFor({ timeout: 20000 });
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const res = await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
      return res.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
    record(
      "RAD-06-radiology",
      "frontend-contract-test",
      "axe /radiology: tanpa pelanggaran critical/serious",
      violations.length === 0,
      violations.length ? JSON.stringify(violations) : "bersih"
    );
  } finally {
    await context.close();
  }
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
    console.error("E2E gagal berjalan:", e);
    process.exit(2);
  });
