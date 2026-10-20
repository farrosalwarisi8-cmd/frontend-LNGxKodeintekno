#!/usr/bin/env node
/**
 * E2E Fase A2 — alur Laboratorium (frontend-contract-test, TANPA backend).
 *
 * Cakupan (Tugas 1-6 & 9):
 *   LAB-01  daftar order: tampil, filter status, pencarian, badge teks+ikon
 *   LAB-02  state error + tombol coba lagi, empty state
 *   LAB-03  detail order: konteks tertaut sesuai permission (lab TANPA tautan MCU)
 *   LAB-04  "Terima sampel" nonaktif dengan alasan jujur (BLOCKER BACKEND)
 *   LAB-05  input hasil manual: form dari jenis tes API, validasi, ringkasan, kirim
 *   LAB-06  impor CSV: baris valid + baris error, laporan per baris, kirim, ulang gagal
 *   LAB-07  verifikasi analis: sorot abnormal dari API, verifikasi, hasil terkunci
 *   LAB-08  role tanpa izin ditolak (route guard) & menu sesuai permission
 *   LAB-09  axe pada halaman /lab dan detail order
 *
 * Menjalankan (dengan feature flag AKTIF):
 *   NEXT_PUBLIC_FEATURE_LAB=1 npx next build && NEXT_PUBLIC_FEATURE_LAB=1 npx next start -p 3312
 *   E2E_BASE_URL=http://localhost:3312 node e2e/lab/lab-workflows.mjs
 *
 * Env:
 *   E2E_BASE_URL   default http://localhost:3312
 *   E2E_OUT_DIR    default test-artifacts/a2-e2e
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createReporter, ensureDir, launchBrowser, loadPlaywright } from "../lib/browser.mjs";
import { openA2Session } from "./a2-fixtures.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3312").replace(/\/+$/, "");
const OUT = process.env.E2E_OUT_DIR ?? path.join("test-artifacts", "a2-e2e");

const axeSource = fs.readFileSync(
  path.join(path.dirname(require.resolve("axe-core/package.json")), "axe.min.js"),
  "utf8"
);

const reporter = createReporter({
  outDir: OUT,
  meta: { suite: "a2-lab", mode: "frontend-contract-test", baseUrl: BASE, reportName: "a2-lab-report.json" },
});
const { shot } = reporter;

/**
 * Bentuk record() yang menerima boolean (true=PASS, false=FAIL) sebagai
 * status, sehingga setiap asersi otomatis terhitung di ringkasan.
 */
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
    await labListAndFilters(browser);
    await labErrorAndEmptyStates(browser);
    await labDetailAndReceiveSample(browser);
    await labManualEntry(browser);
    await labImport(browser);
    await labVerifyAndLock(browser);
    await labRbac(browser);
    await labA11y(browser);
  } finally {
    await browser.close();
  }
}

/** LAB-01: daftar order + filter + pencarian + badge. */
async function labListAndFilters(browser) {
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-list",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Laboratorium" }).waitFor({ timeout: 20000 });
    await page.getByText("3 order ditemukan").waitFor({ timeout: 15000 });

    record("LAB-01-01", "frontend-contract-test", "daftar order menampilkan seluruh order dari API", true);
    await shot(page, "lab-list-1280x900");

    // Badge status memakai LABEL TEKS (bukan warna saja).
    const body = await bodyText(page);
    record(
      "LAB-01-02",
      "frontend-contract-test",
      "status order tampil dengan label teks (Menunggu sampel / Sedang dianalisis / Hasil diinput)",
      /Menunggu sampel/.test(body) && /Sedang dianalisis/.test(body) && /Hasil diinput/.test(body),
      "label teks terlihat"
    );

    // Filter status via select berlabel.
    await page.getByLabel("Status").selectOption("ORDERED");
    await page.getByText("1 order ditemukan").waitFor({ timeout: 10000 });
    record("LAB-01-03", "frontend-contract-test", "filter status menyaring daftar order", true);
    await page.getByLabel("Status").selectOption("");

    // Pencarian bebas.
    await page.getByLabel("Cari order lab").fill("Hemoglobin");
    await page.getByText("1 order ditemukan").waitFor({ timeout: 10000 });
    const searchText = await bodyText(page);
    record(
      "LAB-01-04",
      "frontend-contract-test",
      "pencarian nama tes menemukan order yang sesuai",
      searchText.includes("LO-2026-002") && !searchText.includes("LO-2026-001"),
      "hanya LO-2026-002 tampil"
    );

    // Empty state saat tidak ada yang cocok.
    await page.getByLabel("Cari order lab").fill("zzz-tidak-ada");
    await page.getByText("Tidak ada order lab ditemukan").waitFor({ timeout: 10000 });
    record("LAB-01-05", "frontend-contract-test", "empty state tampil saat tidak ada hasil", true);
    await shot(page, "lab-empty-1280x900");
  } finally {
    await context.close();
  }
}

/** LAB-02: state error (dengan coba lagi). */
async function labErrorAndEmptyStates(browser) {
  const { context, page, state, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-error",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    state.failOrdersList = true;
    await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Coba lagi" }).waitFor({ timeout: 15000 });
    record("LAB-02-01", "frontend-contract-test", "state error menampilkan pesan + tombol coba lagi", true);
    await shot(page, "lab-error-1280x900");

    state.failOrdersList = false;
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.getByText("3 order ditemukan").waitFor({ timeout: 15000 });
    record("LAB-02-02", "frontend-contract-test", "tombol coba lagi memuat ulang daftar order", true);
  } finally {
    await context.close();
  }
}

/** LAB-03 + LAB-04: detail order, konteks tertaut per permission, terima sampel. */
async function labDetailAndReceiveSample(browser) {
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-detail",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/lab/LO-2026-001`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Detail order lab" }).waitFor({ timeout: 20000 });

    const body = await bodyText(page);
    // Role lab TIDAK punya view-mcu → identitas minimum tanpa tautan.
    record(
      "LAB-03-01",
      "frontend-contract-test",
      "order menampilkan identitas kunjungan/MCU dari data API",
      body.includes("ENC-101") && body.includes("MCU-301"),
      "encounter & mcu id tampil"
    );
    const mcuLink = await page.getByRole("link", { name: /Siklus MCU/ }).count();
    const visitLink = await page.getByRole("link", { name: /Kunjungan/ }).count();
    record(
      "LAB-03-02",
      "frontend-contract-test",
      "role lab TANPA view-mcu melihat identitas minimum tanpa tautan MCU/kunjungan",
      mcuLink === 0 && visitLink === 0,
      `mcuLink=${mcuLink} visitLink=${visitLink}`
    );

    // Terima sampel: tombol tampil (role berizin) tapi nonaktif dengan alasan.
    const receiveBtn = page.getByRole("button", { name: "Terima sampel" });
    await receiveBtn.waitFor({ timeout: 10000 });
    const disabled = await receiveBtn.isDisabled();
    const reason = await page.getByText(/BLOCKER BACKEND/).count();
    record(
      "LAB-04-01",
      "frontend-contract-test",
      '"Terima sampel" nonaktif dengan alasan jujur (endpoint status order belum ada)',
      disabled && reason > 0,
      `disabled=${disabled} alasanTampil=${reason > 0}`
    );
    await shot(page, "lab-detail-1280x900");
  } finally {
    await context.close();
  }
}

/** LAB-05: input hasil manual — form dinamis dari jenis tes API + validasi + kirim. */
async function labManualEntry(browser) {
  const { context, page, calls, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-manual",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/lab/LO-2026-001`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Input hasil manual" }).waitFor({ timeout: 20000 });

    // Form dibangun dari test_type API: nama tes + rentang referensi tampil.
    const body = await bodyText(page);
    record(
      "LAB-05-01",
      "frontend-contract-test",
      "form input dibangun dari jenis tes API (nama + rentang referensi dari data)",
      body.includes("Gula Darah Sewaktu") && body.includes("70 – 200"),
      "jenis tes & rentang dari API tampil"
    );

    // Validasi teknis: nilai non-angka ditolak.
    await page.getByLabel("Nilai", { exact: true }).fill("bukan-angka");
    await page.getByRole("button", { name: "Tinjau sebelum kirim" }).click();
    await page.getByText("Nilai harus berupa angka yang valid.").waitFor({ timeout: 10000 });
    record("LAB-05-02", "frontend-contract-test", "nilai non-angka ditolak validasi teknis", true);

    // Isi valid → ringkasan sebelum kirim → kirim.
    await page.getByLabel("Nilai", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Tinjau sebelum kirim" }).click();
    await page.getByText("Ringkasan sebelum kirim").waitFor({ timeout: 10000 });
    record("LAB-05-03", "frontend-contract-test", "ringkasan tampil sebelum pengiriman", true);
    await shot(page, "lab-review-1280x900");

    await page.getByRole("button", { name: "Kirim hasil" }).click();
    await page.getByText("Hasil tersimpan").waitFor({ timeout: 15000 });

    const posts = calls.filter((c) => c.method === "POST" && c.path.endsWith("/diagnostic/lab-results"));
    const payload = posts[0]?.body ?? {};
    const noAbnormalFromClient = !("abnormalFlag" in (payload.values?.[0] ?? {}));
    record(
      "LAB-05-04",
      "frontend-contract-test",
      "payload kirim sesuai kontrak (labOrderItemId + values) dan TANPA abnormalFlag dari klien",
      payload.labOrderItemId === "item-1" &&
        payload.values?.[0]?.parameterName === "Gula Darah Sewaktu" &&
        payload.values?.[0]?.numericValue === 123 &&
        noAbnormalFromClient,
      `posts=${posts.length} payload=${JSON.stringify(payload)}`
    );
    await shot(page, "lab-saved-1280x900");
  } finally {
    await context.close();
  }
}

/** LAB-06: impor CSV — valid + error, laporan per baris, kirim, ulang hanya yang gagal. */
async function labImport(browser) {
  const { context, page, state, calls, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-import",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/lab/import`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Impor hasil lab (CSV)" }).waitFor({ timeout: 20000 });

    // Template unduhan dihasilkan dari order termuat (bukan hardcode).
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByRole("button", { name: /Unduh template/ }).click(),
    ]);
    const tplName = download.suggestedFilename();
    record(
      "LAB-06-01",
      "frontend-contract-test",
      "template CSV bisa diunduh dan dihasilkan dari daftar order termuat",
      tplName.endsWith(".csv"),
      `file=${tplName}`
    );

    // Berkas dengan baris valid + baris error (order tak cocok, tipe salah).
    const csv = [
      "order_id,parameter_name,value_type,value,unit",
      "LO-2026-001,Gula Darah Sewaktu,number,150,mg/dL",
      "LO-TIDAK-ADA,Gula Darah Sewaktu,number,10,mg/dL",
      "LO-2026-001,Kolesterol Total,number,abc,mg/dL",
    ].join("\n");
    await page
      .getByLabel("Pilih berkas CSV hasil lab")
      .setInputFiles({ name: "impor-uji.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });

    await page.getByText("Pratinjau baris valid (1)").waitFor({ timeout: 15000 });
    const preview = await bodyText(page);
    record(
      "LAB-06-02",
      "frontend-contract-test",
      "pratinjau memisahkan baris valid (1) dan bermasalah (2)",
      preview.includes("Pratinjau baris valid (1)") && preview.includes("Baris bermasalah (2)"),
      "pemisahan valid/error per baris"
    );
    record(
      "LAB-06-03",
      "frontend-contract-test",
      "baris dengan order_id tak dikenal DITANDAI (tidak ditebak)",
      preview.includes('order_id "LO-TIDAK-ADA" tidak ditemukan'),
      "order_id tak cocok ditandai eksplisit"
    );
    record(
      "LAB-06-04",
      "frontend-contract-test",
      "baris dengan tipe salah dilaporkan per baris + kolom",
      preview.includes("Tipe salah") && preview.includes("value"),
      "laporan kolom & alasan tampil"
    );
    await shot(page, "lab-import-preview-1280x900");

    // Laporan kesalahan bisa diunduh.
    const [errDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      page.getByRole("button", { name: "Unduh laporan kesalahan" }).click(),
    ]);
    record(
      "LAB-06-05",
      "frontend-contract-test",
      "laporan kesalahan per baris bisa diunduh",
      errDownload.suggestedFilename().endsWith(".csv"),
      `file=${errDownload.suggestedFilename()}`
    );

    // Baris valid dikirim; baris gagal (simulasi 500) bisa diulang terpisah.
    state.failPostValuesOnce.add(150);
    await page.getByRole("button", { name: "Kirim 1 baris valid" }).click();
    await page.getByText("Ringkasan pengiriman").waitFor({ timeout: 15000 });
    const summary = await bodyText(page);
    record(
      "LAB-06-06",
      "frontend-contract-test",
      "ringkasan menampilkan sukses/gagal per baris (baris pertama digagalkan simulasi 500)",
      /0\s+sukses/.test(summary) && /1\s+gagal/.test(summary),
      (summary.match(/\d+\s+sukses|\d+\s+gagal/g) ?? []).join(" · ") || summary.slice(0, 120)
    );
    const retryBtn = page.getByRole("button", { name: /Ulangi \d+ baris gagal/ });
    const hasRetry = await retryBtn.count();
    if (hasRetry > 0) {
      const before = calls.filter((c) => c.method === "POST" && c.path.endsWith("/diagnostic/lab-results")).length;
      await retryBtn.click();
      await page.waitForTimeout(1500);
      const after = calls.filter((c) => c.method === "POST" && c.path.endsWith("/diagnostic/lab-results")).length;
      record(
        "LAB-06-07",
        "frontend-contract-test",
        "ulang gagal mengirim HANYA baris yang gagal (1 request tambahan)",
        after - before === 1,
        `delta=${after - before}`
      );
    } else {
      record("LAB-06-07", "frontend-contract-test", "ulang gagal tersedia bila ada baris gagal", false, "tidak ada opsi ulang");
    }
    const posts = calls.filter((c) => c.method === "POST" && c.path.endsWith("/diagnostic/lab-results"));
    record(
      "LAB-06-08",
      "frontend-contract-test",
      "pengiriman per baris ke endpoint yang ada (tidak ada endpoint massal di kontrak)",
      posts.length >= 1 && posts.every((p) => p.body?.labOrderItemId),
      `posts=${posts.length}`
    );
  } finally {
    await context.close();
  }
}

/** LAB-07: verifikasi analis — abnormal dari API, verifikasi, hasil terkunci. */
async function labVerifyAndLock(browser) {
  const { context, page, calls, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-verify",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    await page.goto(`${BASE}/lab/LO-2026-002`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Verifikasi analis" }).waitFor({ timeout: 20000 });

    const body = await bodyText(page);
    record(
      "LAB-07-01",
      "frontend-contract-test",
      "nilai abnormal ditandai dengan ikon + teks dari abnormal_flag API",
      body.includes("Di luar rentang"),
      "label 'Di luar rentang' dari data API"
    );

    await page.getByRole("button", { name: "Verifikasi hasil ini" }).click();
    await page.getByRole("button", { name: "Ya, verifikasi" }).waitFor({ timeout: 10000 });
    await shot(page, "lab-verify-modal-1280x900");
    await page.getByRole("button", { name: "Ya, verifikasi" }).click();

    // Setelah verified_at terisi: terkunci + status "menunggu tanda tangan".
    await page.getByText("Hasil terkunci").waitFor({ timeout: 15000 });
    const lockedText = await bodyText(page);
    record(
      "LAB-07-02",
      "frontend-contract-test",
      'setelah verifikasi hasil terkunci dengan status "Terverifikasi, menunggu tanda tangan"',
      lockedText.includes("Terverifikasi, menunggu tanda tangan"),
      "status batas akhir A2 tampil"
    );
    record(
      "LAB-07-03",
      "frontend-contract-test",
      "hasil terkunci menjelaskan koreksi lewat addendum (Fase A4)",
      /koreksi dilakukan lewat addendum/i.test(lockedText),
      "penjelasan addendum tampil"
    );
    const verifyBtnAfter = await page.getByRole("button", { name: "Verifikasi hasil ini" }).count();
    record(
      "LAB-07-04",
      "frontend-contract-test",
      "tombol verifikasi hilang setelah terkunci (read-only)",
      verifyBtnAfter === 0,
      `sisaTombol=${verifyBtnAfter}`
    );
    const verifyCalls = calls.filter((c) => c.method === "POST" && /\/lab-results\/[^/]+\/verify$/.test(c.path));
    record(
      "LAB-07-05",
      "frontend-contract-test",
      "verifikasi memakai endpoint verify yang ada (POST /diagnostic/lab-results/:id/verify)",
      verifyCalls.length === 1,
      `calls=${verifyCalls.length}`
    );
    await shot(page, "lab-locked-1280x900");
  } finally {
    await context.close();
  }
}

/** LAB-08: RBAC — role tanpa izin ditolak route; menu sesuai permission. */
async function labRbac(browser) {
  // Apoteker: TANPA view-lab-orders / input-lab-result → route /lab ditolak.
  {
    const { context, page, pageErrors } = await openA2Session(browser, {
      base: BASE, role: "apoteker", label: "lab-rbac-apoteker",
    });
    reporter.pageErrors.push(...pageErrors);
    try {
      await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Akses Ditolak" }).waitFor({ timeout: 15000 });
      record("LAB-08-01", "frontend-contract-test", "role tanpa izin (apoteker) ditolak di route /lab", true);
      await shot(page, "lab-denied-1280x900");
    } finally {
      await context.close();
    }
  }

  // Perawat: punya view-lab-orders TETAPI tidak punya input-lab-result → ditolak.
  {
    const { context, page, pageErrors } = await openA2Session(browser, {
      base: BASE, role: "perawat", label: "lab-rbac-perawat",
    });
    reporter.pageErrors.push(...pageErrors);
    try {
      await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Akses Ditolak" }).waitFor({ timeout: 15000 });
      record(
        "LAB-08-02",
        "frontend-contract-test",
        "role view-only (perawat) tetap ditolak route /lab sesuai guard input-lab-result",
        true
      );
    } finally {
      await context.close();
    }
  }

  // Lab: punya izin → menu "Lab & Radiologi" tampil & mengarah ke /lab (bukan /mcu).
  {
    const { context, page, pageErrors } = await openA2Session(browser, {
      base: BASE, role: "lab", label: "lab-rbac-menu",
    });
    reporter.pageErrors.push(...pageErrors);
    try {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      const labNav = page.getByRole("link", { name: "Lab & Radiologi" }).first();
      await labNav.waitFor({ timeout: 15000 });
      const href = await labNav.getAttribute("href");
      record(
        "LAB-08-03",
        "frontend-contract-test",
        'menu "Lab & Radiologi" tampil untuk role berizin dan mengarah ke /lab (bukan /mcu)',
        href === "/lab",
        `href=${href}`
      );
    } finally {
      await context.close();
    }
  }

  // Dokter OH: punya view-lab-orders + view-mcu → tautan MCU muncul di daftar.
  {
    const { context, page, pageErrors } = await openA2Session(browser, {
      base: BASE, role: "dokter-oh", label: "lab-rbac-dokter-oh",
    });
    reporter.pageErrors.push(...pageErrors);
    try {
      await page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
      await page.getByText("3 order ditemukan").waitFor({ timeout: 20000 });
      const mcuLink = await page.getByRole("link", { name: /Siklus MCU/ }).count();
      record(
        "LAB-08-04",
        "frontend-contract-test",
        "role dengan view-mcu melihat tautan MCU pada konteks order",
        mcuLink > 0,
        `mcuLink=${mcuLink}`
      );
    } finally {
      await context.close();
    }
  }
}

/** LAB-09: axe pada halaman baru. */
async function labA11y(browser) {
  const pages = [
    { url: "/lab", name: "lab" },
    { url: "/lab/LO-2026-002", name: "lab-detail" },
    { url: "/lab/import", name: "lab-import" },
  ];
  const { context, page, pageErrors } = await openA2Session(browser, {
    base: BASE, role: "lab", label: "lab-a11y",
  });
  reporter.pageErrors.push(...pageErrors);
  try {
    for (const p of pages) {
      await page.goto(`${BASE}${p.url}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const res = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        return res.violations
          .filter((v) => v.impact === "critical" || v.impact === "serious")
          .map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 220), summary: n.failureSummary })),
          }));
      });
      record(
        `LAB-09-${p.name}`,
        "frontend-contract-test",
        `axe ${p.url}: tanpa pelanggaran critical/serious`,
        violations.length === 0,
        violations.length ? JSON.stringify(violations) : "bersih"
      );
    }
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
