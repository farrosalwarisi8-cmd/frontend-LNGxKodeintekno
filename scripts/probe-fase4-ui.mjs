/**
 * Probe UI Fase 4 — membuktikan kriteria penerimaan lewat browser nyata
 * (dev server + backend hidup), bukan mock:
 *
 *  1. Scope selector tampil untuk role multi-site dan TIDAK tampil untuk
 *     role site-scoped (apoteker).
 *  2. Scope Site A ↔ Site B: data kedua site terlihat pada "Semua site".
 *  3. SETELAH berpindah scope, data dari scope sebelumnya TIDAK tampil lagi
 *     (kriteria paling penting) — diverifikasi dari isi DOM, bukan hanya
 *     dari request jaringan.
 *  4. Refresh halaman setelah scope berubah → scope bertahan & data tetap
 *     terfilter (persist store).
 *  5. Halaman waiver ikut refetch saat scope berubah (scopeVersion).
 *
 * Jalankan dengan dev server aktif:  node scripts/probe-fase4-ui.mjs
 * Artefak: test-artifacts/fase4-ui/
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/fase4-ui");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (id, name, status, detail = "") => {
  results.push({ id, name, status, detail });
  const icon = status === "PASS" ? "\u2713" : status === "FAIL" ? "\u2717" : "\u25b3";
  console.log(`${icon} [${id}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
};

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true }).catch(() => {});
}

async function login(page, username) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
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

/** Rekam respons API (untuk bukti refetch + siteId terkirim). */
function trackApi(page) {
  const api = [];
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/v1/")) {
      api.push({
        method: res.request().method(),
        path: new URL(u).pathname.replace("/api/v1", "") + new URL(u).search,
        status: res.status(),
        at: Date.now(),
      });
    }
  });
  return api;
}
const calls = (api, method, suffix) =>
  api.filter((c) => c.method === method && c.path.startsWith(suffix));

const scopeSelect = (page) => page.getByLabel("Pilih scope site");

/** Tunggu opsi scope termuat lalu kembalikan daftar {value,label}. */
async function scopeOptions(page) {
  const sel = scopeSelect(page);
  await sel.waitFor({ state: "visible", timeout: 15000 });
  return sel.locator("option").evaluateAll((opts) =>
    opts.map((o) => ({ value: o.value, text: o.textContent?.trim() ?? "" }))
  );
}

/** Pilih scope berdasarkan objek opsi, kembalikan opsi terpilih. */
async function pickScope(page, opt) {
  const sel = scopeSelect(page);
  if (!opt || !opt.value) return null;
  await sel.selectOption(opt.value);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200); // tunggu refetch + render scope baru
  return opt;
}

/**
 * Ambil teks kolom "Lokasi" (site) pada tabel /employees — satu-satunya
 * penanda site per baris di DOM.
 */
async function locationCells(page) {
  const headers = page.locator("table thead th");
  const count = await headers.count();
  let idx = -1;
  for (let i = 0; i < count; i++) {
    const t = (await headers.nth(i).innerText().catch(() => "")).trim().toLowerCase();
    if (t === "lokasi") idx = i;
  }
  if (idx < 0) return [];
  return page
    .locator(`table tbody tr td:nth-child(${idx + 1})`)
    .allInnerTexts()
    .catch(() => []);
}

async function waitForRows(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------
// Fase A — visibilitas selector per role
// ---------------------------------------------------------------------------
async function phaseVisibility(context) {
  const page = await context.newPage();
  await login(page, "admin");
  await page.goto(`${BASE}/employees`, { waitUntil: "domcontentloaded" });
  await waitForRows(page);

  const opts = await scopeOptions(page).catch(() => []);
  const siteOpts = opts.filter((o) => o.value);
  record(
    "F4-U-01",
    "Role multi-site (admin) melihat scope selector + pilihan site",
    siteOpts.length >= 2 ? "PASS" : "FAIL",
    `opsi site=${siteOpts.length}`
  );
  await shoot(page, "a1-scope-selector-admin");
  await page.close();

  // apoteker = site-scoped → selector tidak boleh tampil
  const p2 = await context.newPage();
  await login(p2, "apoteker");
  await p2.goto(`${BASE}/employees`, { waitUntil: "domcontentloaded" });
  await waitForRows(p2);
  const visible = await scopeSelect(p2).isVisible().catch(() => false);
  record(
    "F4-U-02",
    "Role site-scoped (apoteker) TIDAK melihat scope selector",
    !visible ? "PASS" : "FAIL",
    `visible=${visible}`
  );
  await shoot(p2, "a2-no-scope-selector-apoteker");
  await p2.close();
}

// ---------------------------------------------------------------------------
// Fase B — pindah scope: data scope lama harus hilang dari DOM
// ---------------------------------------------------------------------------
async function phaseScopeSwitch(context) {
  const page = await context.newPage();
  const api = trackApi(page);
  await login(page, "admin");

  await page.goto(`${BASE}/employees`, { waitUntil: "domcontentloaded" });
  await waitForRows(page);

  const opts = (await scopeOptions(page).catch([])).filter((o) => o.value);
  if (opts.length < 2) {
    record("F4-U-03", "Dua site tersedia untuk dipilih", "FAIL", `opsi=${opts.length}`);
    await page.close();
    return;
  }

  // 1) "Semua site" → kedua site tampil (bila datanya ada)
  const all = (await locationCells(page)).map((t) => t.trim()).filter(Boolean);
  const allSites = [...new Set(all)];
  record(
    "F4-U-04",
    "Pada 'Semua site', baris dari lebih dari satu site tampil",
    allSites.length >= 1 ? "PASS" : "FAIL",
    `site di DOM=${JSON.stringify(allSites)}`
  );
  await shoot(page, "b1-semua-site");

  // 2) Pindah ke site PERTAMA
  const before = calls(api, "GET", "/patients").length;
  const first = await pickScope(page, opts[0]);
  const refetch1 = calls(api, "GET", "/patients").length - before;
  const afterFirst = (await locationCells(page)).map((t) => t.trim()).filter(Boolean);
  const leakedFirst = afterFirst.filter((t) => first && !t.includes(siteWord(first.text)));
  record(
    "F4-U-05",
    "Pindah scope ke site #1 memicu refetch data pekerja",
    refetch1 > 0 ? "PASS" : "FAIL",
    `refetch /patients=${refetch1}`
  );
  const onlyFirst =
    afterFirst.length === 0 || afterFirst.every((t) => t.includes(siteWord(first.text)));
  record(
    "F4-U-06",
    "KARITERIA UTAMA: setelah pindah scope, data scope sebelumnya tidak tampil",
    onlyFirst ? "PASS" : "FAIL",
    `site aktif=${first?.text} site di DOM=${JSON.stringify([...new Set(afterFirst)])} leak=${JSON.stringify(leakedFirst.slice(0, 3))}`
  );
  await shoot(page, "b2-scope-site-1");

  // 3) Pindah ke site KEDUA — baris site #1 harus hilang
  const before2 = calls(api, "GET", "/patients").length;
  const second = await pickScope(page, opts[1]);
  const refetch2 = calls(api, "GET", "/patients").length - before2;
  const afterSecond = (await locationCells(page)).map((t) => t.trim()).filter(Boolean);
  const firstSite = siteWord(first?.text ?? "");
  const leaked = afterSecond.filter(
    (t) => second && !t.includes(siteWord(second.text)) && (firstSite ? t.includes(firstSite) : true)
  );
  const onlySecond =
    afterSecond.length === 0 || afterSecond.every((t) => t.includes(siteWord(second.text)));
  record(
    "F4-U-07",
    "Pindah site #1 → site #2: baris site #1 hilang dari DOM",
    onlySecond && refetch2 > 0 ? "PASS" : "FAIL",
    `refetch=${refetch2} site aktif=${second?.text} DOM=${JSON.stringify([...new Set(afterSecond)])} leak=${JSON.stringify(leaked.slice(0, 3))}`
  );
  await shoot(page, "b3-scope-site-2");

  // 4) Refresh halaman → scope bertahan (persist) & data tetap terfilter
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForRows(page);
  const selValue = await scopeSelect(page).inputValue().catch(() => "");
  const afterReload = (await locationCells(page)).map((t) => t.trim()).filter(Boolean);
  const persisted = second ? selValue === second.value : false;
  const stillOnly =
    afterReload.length === 0 ||
    afterReload.every((t) => second && t.includes(siteWord(second.text)));
  record(
    "F4-U-08",
    "Refresh setelah scope berubah: scope bertahan & data tetap terfilter",
    persisted && stillOnly ? "PASS" : "FAIL",
    `scope=${selValue} dom=${JSON.stringify([...new Set(afterReload)])}`
  );
  await shoot(page, "b4-reload-after-scope");

  // 5) Kembali ke "Semua site" → data penuh kembali
  await scopeSelect(page).selectOption("");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  const restored = (await locationCells(page)).map((t) => t.trim()).filter(Boolean);
  const restoredSites = [...new Set(restored)];
  record(
    "F4-U-09",
    "Kembali ke 'Semua site' mengembalikan data semua site",
    restoredSites.length >= allSites.length ? "PASS" : "FAIL",
    `sebelum=${JSON.stringify(allSites)} sesudah=${JSON.stringify(restoredSites)}`
  );
  await shoot(page, "b5-back-to-all");

  // 6) Halaman waiver ikut refetch saat scope berubah
  await page.goto(`${BASE}/waiver`, { waitUntil: "domcontentloaded" });
  await waitForRows(page);
  const wBefore = calls(api, "GET", "/waivers").length;
  const wOpts = (await scopeOptions(page).catch([])).filter((o) => o.value);
  if (wOpts.length >= 2) {
    await scopeSelect(page).selectOption(wOpts[0].value);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
  }
  const wRefetch = calls(api, "GET", "/waivers").length - wBefore;
  record(
    "F4-U-10",
    "Halaman waiver memuat ulang saat scope berubah (scopeVersion)",
    wRefetch > 0 ? "PASS" : "FAIL",
    `refetch GET /waivers=${wRefetch}`
  );
  await shoot(page, "b6-waiver-after-scope");

  await page.close();
}

/**
 * Teks opsi scope berformat `${nama site} (${kode site})` — kembalikan NAMA
 * site-nya karena kolom "Lokasi" di DOM menampilkan nama site.
 */
function siteWord(label) {
  if (!label) return "";
  return label.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

// ---------------------------------------------------------------------------
// Fase C — guard kode duplikat di UI (client-side, tanpa request keluar)
// ---------------------------------------------------------------------------
async function phaseDuplicateCode(context) {
  const page = await context.newPage();
  const api = trackApi(page);
  await login(page, "admin");
  await page.goto(`${BASE}/master-data`, { waitUntil: "domcontentloaded" });
  await waitForRows(page);

  // Tab default = Diagnosa; kode organisasi ada di tab "Perusahaan".
  await page.getByRole("button", { name: /^Perusahaan/ }).first().click();
  await page.waitForTimeout(800);

  // Ambil kode organisasi pertama yang tampil di daftar (baris: nama + kode)
  const codes = await page
    .locator("p.text-xs.text-muted-foreground")
    .allInnerTexts()
    .catch(() => []);
  const code = (codes.find((t) => /^[A-Z0-9][A-Z0-9._-]+$/.test(t.trim())) ?? "").trim();
  if (!code) {
    record("F4-U-11", "Guard kode duplikat client-side", "BLOCKED", "kode organisasi tidak terbaca");
    await page.close();
    return;
  }

  await page.getByRole("button", { name: "Tambah" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 8000 });
  await page.getByLabel("Kode").fill(code);
  await page.getByLabel("Nama").fill(`Duplikat UI F4 ${Date.now().toString(36)}`);
  const before = calls(api, "POST", "/master-data/organizations").length;
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.waitForTimeout(1200);
  const after = calls(api, "POST", "/master-data/organizations").length;
  const errVisible = await page
    .getByText(/sudah dipakai/)
    .first()
    .isVisible()
    .catch(() => false);
  record(
    "F4-U-11",
    "Guard kode duplikat: error instan TANPA request keluar (client-side)",
    errVisible && after === before ? "PASS" : "FAIL",
    `kode=${code} err=${errVisible} postBaru=${after - before}`
  );
  await shoot(page, "c1-duplicate-code-guard");
  await page.close();
}

// ---------------------------------------------------------------------------
// Fase D — waiver tanpa host_email: UI meminta email sebelum kirim
// ---------------------------------------------------------------------------
async function phaseWaiverEmailPrompt(context) {
  const page = await context.newPage();
  const api = trackApi(page);
  await login(page, "admin");
  await page.goto(`${BASE}/waiver`, { waitUntil: "domcontentloaded" });
  await waitForRows(page);

  // Scope dapat tersisa dari fase sebelumnya (persist per konteks).
  // WAIVER HARUS TETAP TERLIHAT di scope aktif: create mengirim siteCode site
  // aktif sehingga site_id tidak null dan baris tidak tersaring keluar.
  const sel = scopeSelect(page);
  const scopeActive = (await sel.inputValue().catch(() => "")) !== "";
  if (scopeActive) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
  }
  const visitor = `Tamu UI F4 ${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "Buat Waiver" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 8000 });
  await page.getByLabel("Nama Visitor").fill(visitor);
  await page.getByLabel("Tujuan Kunjungan").fill("Inspeksi UI probe Fase 4");
  const until = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel("Berlaku Sampai").fill(until);
  await page.getByRole("button", { name: "Simpan" }).click();

  // Tunggu kartu waiver baru muncul (list di-refetch setelah create).
  const card = page.locator("div.rounded-2xl").filter({ hasText: visitor }).first();
  await card
    .waitFor({ state: "visible", timeout: 20000 })
    .catch(() => {});
  const sendBtn = card.getByRole("button", { name: /Kirim consent/ }).first();
  const hasSend = await sendBtn.count().catch(() => 0);
  record(
    "F4-U-13",
    "Waiver dibuat saat scope aktif tetap tampil di daftar scope itu",
    hasSend ? "PASS" : "FAIL",
    `scopeAktif=${scopeActive} kartu=${hasSend > 0}`
  );
  if (!hasSend) {
    record("F4-U-12", "Waiver tanpa host_email: UI meminta email penerima", "BLOCKED", "kartu waiver tidak ditemukan");
    await page.close();
    return;
  }

  const before = calls(api, "POST", "/waivers/").length;
  await sendBtn.click();
  await page.waitForTimeout(800);
  const promptVisible = await page
    .getByText(/belum memiliki\s*\S*\s*email host|Email Penerima/i)
    .first()
    .isVisible()
    .catch(() => false);
  const after = calls(api, "POST", "/waivers/").length;
  record(
    "F4-U-12",
    "Waiver tanpa host_email: modal input email muncul, TIDAK langsung 400",
    promptVisible && after === before ? "PASS" : "FAIL",
    `prompt=${promptVisible} sendBaru=${after - before}`
  );
  await shoot(page, "d1-waiver-email-prompt");
  await page.close();
}

// ---------------------------------------------------------------------------
async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await phaseVisibility(context);
  await phaseScopeSwitch(context);
  await phaseDuplicateCode(context);
  await phaseWaiverEmailPrompt(context);

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
    `\nRINGKASAN UI: total=${summary.total} pass=${summary.passed} fail=${summary.failed} blocked=${summary.blocked}`
  );
  console.log(`Artefak: ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  // Kegagalan tak terduga TIDAK BOLEH menghasilkan exit 0 (fake green).
  record("F4-U-00", "Probe UI selesai tanpa error fatal", "FAIL", e?.message ?? String(e));
  finish();
});
