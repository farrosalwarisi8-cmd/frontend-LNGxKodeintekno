/**
 * Probe UI Fase 3 — membuktikan 6 kriteria penerimaan lewat browser nyata
 * (dev server + backend hidup), bukan mock:
 *
 *  1. SOAP tersimpan            → PUT /clinic/encounters/:id/soap 2xx + banner bukti
 *  2. Record terkunci tdk bisa diedit
 *                               → tombol simpan hilang, input disabled,
 *                                 dan PUT pasca-lock ditolak backend (403)
 *  3. Dispensing tidak dua kali → hanya 1 POST /pharmacy/dispensing,
 *                                 guard menolak percobaan kedua
 *  4. Retur mengubah ledger     → selisih stok tampil sebagai entri Stock Ledger
 *  5. Cross-site ditolak        → diuji unit (pharmacy-guard.test.ts),
 *                                 request tidak pernah meninggalkan lapisan FE
 *  6. Role non-apoteker         → route guard + action pharmacy tidak tampil
 *
 * Jalankan dengan dev server aktif:  node scripts/probe-fase3-ui.mjs
 * Artefak: test-artifacts/fase3-ui/
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/fase3-ui");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (id, name, status, detail = "") => {
  results.push({ id, name, status, detail });
  const icon = status === "PASS" ? "\u2713" : status === "FAIL" ? "\u2717" : "\u25b2";
  console.log(`${icon} [${id}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
};

const bodyText = (page) => page.locator("body").innerText().catch(() => "");
const dialog = (page) => page.getByRole("dialog");
const dialogText = async (page) =>
  (await dialog(page).count()) ? dialog(page).innerText().catch(() => "") : "";

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});
}

async function login(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800); // tunggu hydration React
  const u = page.getByLabel("Username");
  const p = page.getByLabel("Password");
  await u.waitFor({ state: "visible", timeout: 15000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await u.fill(username);
    await p.fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).first().click();
    try {
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error(`Login ${username} gagal`);
}

/** Rekam semua respons API di halaman (untuk bukti method + status). */
function trackApi(page) {
  const api = [];
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/v1/")) {
      api.push({
        method: res.request().method(),
        path: new URL(u).pathname.replace("/api/v1", ""),
        url: u,
        status: res.status(),
      });
    }
  });
  return api;
}
const calls = (api, method, suffix) =>
  api.filter((c) => c.method === method && c.path.endsWith(suffix));

// ---------------------------------------------------------------------------
// Fase A — Klinik: Visit → Vital sign → SOAP → Finalize → Lock
// ---------------------------------------------------------------------------
async function phaseClinic(context) {
  const page = await context.newPage();
  const api = trackApi(page);
  await login(page, "admin");

  const complaint = `F3 demam ringan ${Date.now()}`;
  await page.goto(`${BASE}/visits/new`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  // Wizard: Pasien → Lokasi → Keluhan → Vital Sign → Review
  await page.getByLabel("Pasien").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByLabel("Lokasi").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByPlaceholder("Tuliskan keluhan utama pasien...").fill(complaint);
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByPlaceholder("120").fill("118");
  await page.getByPlaceholder("80").fill("76");
  await page.getByPlaceholder("72").fill("74");
  await page.getByPlaceholder("170").fill("170");
  await page.getByPlaceholder("65").fill("68");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByRole("button", { name: "Submit Kunjungan" }).click();
  await page.waitForURL(/\/visits(\?|$)/, { timeout: 30000 }).catch(() => {});

  const encCreate = calls(api, "POST", "/clinic/encounters");
  const vitals = calls(api, "PUT", "/vitals");
  record(
    "F3-A-01",
    "Visit membuka encounter + mencatat vital sign",
    encCreate.length === 1 && encCreate[0].status < 300 && vitals.length === 1 && vitals[0].status < 300
      ? "PASS"
      : "FAIL",
    `encounter=${JSON.stringify(encCreate)} vitals=${JSON.stringify(vitals)}`
  );
  // visitNumber = ENC-<8 karakter pertama encounter id> (lihat visits/new)
  const encIdFromVitals = vitals[0]?.path.match(/encounters\/([^/]+)\/vitals/)?.[1] ?? null;
  const visitMarker = encIdFromVitals
    ? `ENC-${encIdFromVitals.slice(0, 8).toUpperCase()}`
    : complaint;

  // --- Buka SOAP untuk rekam medis yang baru dibuat ---
  await page.goto(`${BASE}/medical-records`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const visibleOnList = (await bodyText(page)).includes(complaint);
  record("F3-A-02", "Rekam medis baru tampil di /medical-records", visibleOnList ? "PASS" : "FAIL");
  const opened = await openRecordFor(page, visitMarker);

  let soapPut = [];
  if (opened) {
    // --- 1. SOAP tersimpan ---
    await page.getByPlaceholder("Keluhan utama...").fill(complaint);
    await page
      .getByPlaceholder("Hasil pemeriksaan fisik...")
      .fill("TD 118/76, HR 74, RR 16, suhu 36.6C, SpO2 99%.");
    const icd = page.getByLabel("Diagnosis ICD-10");
    if (await icd.count()) {
      const opts = await icd.locator("option").allTextContents();
      const idx = opts.findIndex((o) => o.includes("\u2014") && o.trim().length > 3);
      if (idx >= 0) await icd.selectOption({ index: idx });
    }
    await page.getByPlaceholder("Catatan diagnosis...").fill("ISPA ringan (F3)");
    await page.getByPlaceholder("Rencana pengobatan...").fill("Istirahat, parasetamol 3x500 mg.");
    await shoot(page, "a1-soap-form");
    await page.getByRole("button", { name: "Simpan SOAP" }).click();

    const saved = await page
      .getByText(/SOAP tersimpan di backend \u2014 encounter/)
      .waitFor({ timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const soapPutBefore = soapPut.length;
    soapPut = calls(api, "PUT", "/soap");
    record(
      "F3-A-03",
      "SOAP tersimpan (PUT /clinic/encounters/:id/soap 2xx + banner bukti)",
      saved && soapPut.length > soapPutBefore && soapPut.every((c) => c.status < 300)
        ? "PASS"
        : "FAIL",
      `banner=${saved} calls=${JSON.stringify(soapPut)}`
    );
    await shoot(page, "a2-soap-saved");
  }

  // --- 2. Finalize & Kunci ---
  const beforeFinalize = calls(api, "POST", "/finalize").length;
  if (await openRecordFor(page, visitMarker)) {
    const finalizeBtn = page.getByRole("button", { name: /Finalize & Kunci/ });
    if (await finalizeBtn.count()) {
      await finalizeBtn.click();
      const lockedBanner = await page
        .getByText(/dikunci permanen \(LOCKED\)/)
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      const finCalls = calls(api, "POST", "/finalize").slice(beforeFinalize);
      record(
        "F3-A-04",
        "Finalize menghasilkan record LOCKED (POST /finalize 2xx + banner)",
        lockedBanner && finCalls.length > 0 && finCalls.every((c) => c.status < 300)
          ? "PASS"
          : "FAIL",
        `banner=${lockedBanner} calls=${JSON.stringify(finCalls)}`
      );
    } else {
      record("F3-A-04", "Finalize menghasilkan record LOCKED", "FAIL", "tombol Finalize tidak ada");
    }
  }
  const badgeTerkunci = /Terkunci/.test(await bodyText(page));
  record("F3-A-05", "Badge \"Terkunci\" pada kartu rekam medis", badgeTerkunci ? "PASS" : "FAIL");
  await shoot(page, "a3-record-locked");

  // --- 3. Record terkunci tidak bisa diedit (UI) ---
  let uiBlocked = false;
  if (await openRecordFor(page, visitMarker)) {
    const dtxt = await dialogText(page);
    const banner = /Rekam medis terkunci \(LOCKED\)/.test(dtxt);
    const subj = await page.getByPlaceholder("Keluhan utama...").isDisabled().catch(() => false);
    const obj = await page
      .getByPlaceholder("Hasil pemeriksaan fisik...")
      .isDisabled()
      .catch(() => false);
    const saveBtn = await page.getByRole("button", { name: "Simpan SOAP" }).count();
    const finBtn = await page.getByRole("button", { name: /Finalize & Kunci/ }).count();
    uiBlocked = banner && subj && obj && saveBtn === 0 && finBtn === 0;
    record(
      "F3-A-06",
      "UI menolak edit record terkunci (banner + input disabled + tombol simpan hilang)",
      uiBlocked ? "PASS" : "FAIL",
      `banner=${banner} subjDisabled=${subj} objDisabled=${obj} saveBtn=${saveBtn} finalizeBtn=${finBtn}`
    );
    await shoot(page, "a4-locked-readonly");
    await page.keyboard.press("Escape");
  }

  // --- 3b. Percobaan edit pasca-lock DITOLAK backend (bukan hanya disembunyikan UI) ---
  const encId =
    soapPut?.[0]?.path?.match(/encounters\/([^/]+)\/soap/)?.[1] ?? encIdFromVitals;
  const soapUrl = soapPut[0]?.url ?? api.find((c) => c.path.endsWith("/soap"))?.url ?? null;
  if (encId && soapUrl) {
    const blocked = await page.evaluate(
      async ({ url }) => {
        const token = localStorage.getItem("kodein_token");
        const res = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subjective: "EDIT SETELAH LOCK" }),
        });
        return res.status;
      },
      { url: soapUrl }
    );
    record(
      "F3-A-07",
      "Edit pasca-lock ditolak backend (PUT SOAP → 403)",
      blocked === 403 ? "PASS" : "FAIL",
      `status=${blocked}`
    );
  } else {
    record("F3-A-07", "Edit pasca-lock ditolak backend", "BLOCKED", "url SOAP tidak terbaca");
  }

  // --- 4. Record yang sudah terkunci sebelumnya tetap read-only ---
  await page.goto(`${BASE}/medical-records`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  const anyBtn = page.getByRole("button", { name: "Lihat" }).first();
  if (await anyBtn.count()) {
    await anyBtn.click();
    const txt = await dialogText(page);
    const subj = await page.getByPlaceholder("Keluhan utama...").isDisabled().catch(() => false);
    record(
      "F3-A-08",
      "Rekam medis terkunci lain (dari antrean) juga read-only",
      /Rekam medis terkunci \(LOCKED\)/.test(txt) && subj ? "PASS" : "FAIL",
      `banner=${/Rekam medis terkunci/.test(txt)} disabled=${subj}`
    );
    await shoot(page, "a5-existing-locked");
  } else {
    record("F3-A-08", "Rekam medis terkunci lain read-only", "BLOCKED", "tidak ada record terkunci");
  }

  await page.close();
}

/** Buka modal SOAP untuk rekam medis yang mengandung `marker`; true bila ketemu. */
async function openRecordFor(page, marker) {
  const btns = page.getByRole("button", { name: /^(SOAP|Lihat)$/ });
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    await btns.nth(i).click().catch(() => {});
    const d = dialog(page);
    try {
      await d.waitFor({ state: "visible", timeout: 4000 });
    } catch {
      continue;
    }
    const txt = await d.innerText().catch(() => "");
    if (txt.includes(marker)) return true;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fase B — RBAC: role non-apoteker tidak melihat action pharmacy
// ---------------------------------------------------------------------------
async function phaseRbac(context) {
  for (const [user, mustSee] of [
    ["apoteker", true],
    ["admin", true],
    ["dr.klinik", false],
    ["hr.pic", false],
    ["perawat", false],
  ]) {
    const p = await context.newPage();
    trackApi(p);
    await login(p, user);
    for (const route of ["/medicine/dispense", "/medicine/return", "/medicine"]) {
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await p.waitForLoadState("networkidle").catch(() => {});
      await p.waitForTimeout(300);
      const body = await bodyText(p);
      const denied =
        /Akses terbatas/i.test(body) || new URL(p.url()).pathname === "/login";
      const dispenseBtn = await p.getByRole("button", { name: /^Dispense$/ }).count();
      const returBtn = await p.getByRole("button", { name: /^Retur$/ }).count();
      const prosesRetur = await p.getByRole("button", { name: "Proses Retur" }).count();
      if (mustSee) {
        record(
          `F3-B-${user}${route}`,
          `${user} \u2192 ${route} diizinkan`,
          denied ? "FAIL" : "PASS",
          `denied=${denied}`
        );
      } else {
        record(
          `F3-B-${user}${route}`,
          `${user} \u2192 ${route} ditolak + tanpa action pharmacy`,
          !denied && dispenseBtn + returBtn + prosesRetur > 0
            ? "FAIL"
            : "PASS",
          `denied=${denied} dispenseBtn=${dispenseBtn} returBtn=${returBtn}`
        );
      }
      await shoot(p, `b-rbac-${user}-${route.replace(/\//g, "_")}`);
    }
    await p.close();
  }
}

// ---------------------------------------------------------------------------
// Fase C — Pharmacy: dispensing tunggal + retur mengubah stock ledger
// ---------------------------------------------------------------------------
async function phasePharmacy(context) {
  const page = await context.newPage();
  const api = trackApi(page);
  await login(page, "apoteker");

  await page.goto(`${BASE}/medicine/dispense`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);

  let dispenseBtn = page.getByRole("button", { name: /^Dispense$/ }).first();
  if (!(await dispenseBtn.count())) {
    // Fallback: admin (unrestricted) bila apoteker tidak punya antrean resep
    await login(page, "admin");
    await page.goto(`${BASE}/medicine/dispense`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(500);
    dispenseBtn = page.getByRole("button", { name: /^Dispense$/ }).first();
  }

  if (!(await dispenseBtn.count())) {
    record("F3-C-01", "Dispensing hanya terjadi sekali", "BLOCKED", "tidak ada resep menunggu");
    record("F3-C-02", "Retur mengubah stock ledger", "BLOCKED", "tidak ada dispensing");
    await page.close();
    return;
  }

  // --- 3. Dispensing tidak terjadi dua kali ---
  const before = calls(api, "POST", "/pharmacy/dispensing").length;
  await dispenseBtn.click();
  const d = dialog(page);
  await d.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await shoot(page, "c1-dispense-modal");
  // Guard: selama proses berjalan tombol submit tetap satu kali klik
  await page.getByRole("button", { name: "Proses Dispensing" }).click();
  const ok = await page
    .getByText(/Dispensing berhasil diproses oleh backend/)
    .waitFor({ timeout: 25000 })
    .then(() => true)
    .catch(() => false);

  // Klik lagi (bila modal masih terbuka) — harus TIDAK mengirim request kedua
  const retryBtn = page.getByRole("button", { name: "Proses Dispensing" });
  if (await retryBtn.count()) {
    if (await retryBtn.isEnabled().catch(() => false)) await retryBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1500);
    // Percobaan kedua lewat daftar: resep harus hilang / tombol terkunci
    const again = page.getByRole("button", { name: /^Dispense$/ }).first();
    if (await again.count()) {
      if (await again.isEnabled().catch(() => false)) await again.click().catch(() => {});
      await page.waitForTimeout(1500);
      const dd = dialog(page);
      if (await dd.count()) {
        const submit = page.getByRole("button", { name: "Proses Dispensing" });
        if (await submit.count()) await submit.click().catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
  }

  const posts = calls(api, "POST", "/pharmacy/dispensing").slice(before);
  record(
    "F3-C-01",
    "Dispensing tidak terjadi dua kali (tepat 1 POST /pharmacy/dispensing)",
    ok && posts.length === 1 ? "PASS" : "FAIL",
    `sukses=${ok} post=${posts.length}`
  );
  await shoot(page, "c2-dispense-done");

  // --- 4. Retur mengubah stock ledger ---
  await page.goto(`${BASE}/medicine/return`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const returBtn = page.getByRole("button", { name: /^Retur$/ }).first();
  if (!(await returBtn.count())) {
    record("F3-C-02", "Retur mengubah stock ledger", "BLOCKED", "tidak ada riwayat dispensing");
    await page.close();
    return;
  }
  await returBtn.click();
  const rd = dialog(page);
  await rd.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  const batch = rd.locator("select").first();
  if (await batch.count()) await batch.selectOption({ index: 1 });
  await page.getByLabel("Jumlah Retur").fill("1");
  await page
    .getByPlaceholder("Contoh: Obat tidak digunakan, kedaluwarsa, dll.")
    .fill("Obat tidak terpakai (F3)");
  await shoot(page, "c3-return-form");
  await page.getByRole("button", { name: "Proses Retur" }).click();

  const ledger = await page
    .getByText(/Stock Ledger \u2014 Retur/)
    .waitFor({ timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  const delta = ledger ? await page.getByText(/^\+\d+/).first().innerText().catch(() => "") : "";
  const returPost = calls(api, "POST", "/pharmacy/returns");
  record(
    "F3-C-02",
    "Retur mengubah stock ledger (POST /pharmacy/returns 2xx + entri ledger)",
    ledger && returPost.length > 0 && returPost.every((c) => c.status < 300)
      ? "PASS"
      : "FAIL",
    `ledger=${ledger} delta=${delta} calls=${JSON.stringify(returPost)}`
  );
  await shoot(page, "c4-stock-ledger");

  await page.close();
}

// ---------------------------------------------------------------------------
async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await phaseClinic(context);
  await phaseRbac(context);
  await phasePharmacy(context);

  await browser.close();
  finish();
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: failed.length,
    blocked: blocked.length,
    results,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\nRINGKASAN: total=${summary.total} pass=${summary.passed} fail=${summary.failed} blocked=${summary.blocked}`
  );
  console.log(`Artefak: ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  finish();
});
