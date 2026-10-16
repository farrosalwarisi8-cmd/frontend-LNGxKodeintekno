#!/usr/bin/env node
/**
 * Skenario utama per peran + penghitung langkah (klik/ketik).
 *
 * Tujuan: membuktikan klaim "satu skenario utama per peran selesai dalam
 * beberapa langkah" secara terukur, bukan berdasarkan perasaan. Setiap langkah
 * pengguna (klik, ketik, tekan tombol) dihitung; skenario gagal bila melebihi
 * anggaran langkah yang tertulis di ROLE_BUDGET.
 *
 * Backend distub (tanpa backend hidup) dan berjalan headless.
 *
 * Env:
 *   ROLE_BASE_URL   default http://localhost:3311
 *   ROLE_FILTER     comma-separated daftar peran (mis. "perawat,dokter-oh")
 */
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.ROLE_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");

/** Anggaran langkah per peran — angka inilah yang diuji, bukan sekadar klaim. */
export const ROLE_BUDGET = {
  "admin-klinik": 16, // wizard kunjungan: pasien, lokasi, keluhan, TTV, simpan
  perawat: 3, // satu klik "Panggil berikutnya"
  "dokter-oh": 10, // buka SOAP, tulis S, pilih ICD, simpan
  apoteker: 6, // buka resep, (cek peringatan), proses
  hr: 3, // dashboard → tindakan cepat "MCU jatuh tempo"
  hse: 3, // dashboard → status kesehatan, filter restriction
  pekerja: 3, // dashboard → status kesehatan saya
};

const d = (offsetDays) =>
  new Date(Date.now() + offsetDays * 24 * 3600 * 1000).toISOString().slice(0, 10);

const PATIENT = {
  id: "pat-1",
  mrn: "MRN-HQ-2026-00001",
  fullName: "Budi Test",
  employeeNo: "EMP-0001",
  site: "HQ",
  orgUnit: "Klinik",
  sex: "M",
  birthDate: "1990-01-01",
  maskedIdentifier: "1234",
  updated_at: "2026-01-01T00:00:00Z",
};

const TICKET = {
  id: "v-1",
  ticket_no: "TKT-0001",
  status: "WAITING",
  counter_id: "counter-1",
  created_at: "2026-01-01T10:00:00Z",
  appointment_id: "appt-1",
  appointment: {
    patient: { id: "pat-1", full_name: "Budi Test", medical_record_no: "MRN-HQ-2026-00001" },
    visit_type: "Klinik",
    scheduled_at: "2026-01-01T10:00:00Z",
  },
};

const MCU_CYCLES = [
  {
    // Jatuh tempo: masa berlaku habis dalam 4 hari.
    id: "cyc-due",
    valid_from: d(-360),
    valid_until: d(4),
    examination_date: d(-360),
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    patient: { id: "pat-1", employee: { site: { name: "HQ" } } },
    ftw_assessment: {
      id: "ftw-due",
      ftw_status: "FIT_WITH_RESTRICTION",
      valid_until: d(4),
      assessed_at: "2026-01-01T00:00:00Z",
      assessed_by: "u-1",
      summary: "Pantau tekanan darah",
      restrictions: [
        { id: "res-1", status: "ACTIVE", description: "Tanpa kerja di ketinggian", review_date: d(20) },
      ],
    },
  },
  {
    // Masih jauh dari jatuh tempo.
    id: "cyc-ok",
    valid_from: d(-10),
    valid_until: d(200),
    examination_date: d(-10),
    updated_at: "2026-02-01T00:00:00Z",
    created_at: "2026-02-01T00:00:00Z",
    patient: { id: "pat-2", employee: { site: { name: "HQ" } } },
    ftw_assessment: {
      id: "ftw-ok",
      ftw_status: "FIT",
      valid_until: d(200),
      assessed_at: "2026-02-01T00:00:00Z",
      assessed_by: "u-1",
      restrictions: [],
    },
  },
];

const PATIENT_2 = { ...PATIENT, id: "pat-2", fullName: "Sari Sehat", mrn: "MRN-HQ-2026-00002" };

const PENDING_RX = [
  {
    id: "rx-1",
    encounter: { patient: { id: "pat-1", full_name: "Budi Test", medical_record_no: "MRN-HQ-2026-00001" } },
    prescribed_at: "2026-01-02T00:00:00Z",
    items: [
      {
        id: "it-1",
        medication_id: "med-1",
        quantity: 2,
        dosage: "3x1",
        medication: { generic_name: "Paracetamol", strength: "500mg" },
      },
    ],
  },
];

const INVENTORY = [
  {
    id: "inv-1",
    medicationCode: "MED-1",
    genericName: "Paracetamol",
    strength: "500mg",
    siteName: "HQ",
    currentStock: 12,
    minimumStock: 10,
    isLowStock: false,
    activeBatchesCount: 1,
    nearestExpiryDate: d(45),
  },
];

/** Stub API untuk seluruh skenario + pencatat request yang diharapkan. */
function makeApiStub(calls) {
  return async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    if (path.includes("/api/v1/")) {
      calls.set(`${method} ${path.replace(/^.*\/api\/v1/, "")}`, true);
    }

    const ok = (data, meta) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, statusCode: 200, data, ...(meta ? { meta } : {}) }),
      });
    const list = (data) => ok(data, { page: 1, limit: 100, total: data.length, totalPages: 1 });

    if (path.includes("/auth/login")) {
      return ok({
        accessToken: "head.body.sig",
        refreshToken: "refresh",
        user: { id: "u-1", username: "demo", roles: ["SYSTEM_ADMIN"], isMedicalRole: true },
      });
    }
    if (path.endsWith("/pharmacy/prescriptions/pending")) return list(PENDING_RX);
    if (path.endsWith("/pharmacy/inventory")) return list(INVENTORY);
    if (path.includes("/pharmacy/dispensing/recommend-batches")) {
      return ok({
        isFullyAllocatable: true,
        shortfall: 0,
        recommendedBatches: [
          { batchId: "batch-1", batchNo: "BN-1", expiryDate: d(45), available: 12, allocated: 2 },
        ],
      });
    }
    if (path.includes("/pharmacy/dispensing")) return ok({ id: "disp-1" });
    if (path.includes("/pharmacy/medication-returns")) return ok({ id: "ret-1" });
    if (path.includes("/clinic/icd10/search")) {
      return list([
        { id: "icd-1", code: "E11", description: "Non-insulin-dependent diabetes mellitus" },
        { id: "icd-2", code: "J06", description: "Acute upper respiratory infections" },
        { id: "icd-3", code: "A90", description: "Dengue fever" },
      ]);
    }
    if (path.includes("/mcu/cycles")) return list(MCU_CYCLES);
    if (path.includes("/clinic/queues/call")) return ok(TICKET);
    if (path.includes("/clinic/queues")) return list([TICKET]);
    if (path.includes("/clinic/encounters") && method === "POST") {
      return ok({ id: "enc-1", status: "DRAFT", locked_at: null });
    }
    if (path.includes("/clinic/encounters")) return ok({ id: "enc-1", status: "DRAFT", locked_at: null });
    if (path.includes("/patients/pat-1/profile")) {
      return ok({
        patient: PATIENT,
        employee: {},
        clinical_encounters: [
          { id: "enc-1", appointment_id: "appt-1", status: "DRAFT", locked_at: null },
        ],
      });
    }
    if (path.endsWith("/patients")) return list([PATIENT, PATIENT_2]);
    return list([]);
  };
}

const results = [];
function check(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const ROLE_USERS = {
  "admin-klinik": { name: "Admin Klinik", title: "Admin Klinik", employeeId: "pat-1" },
  perawat: { name: "Perawat Satu", title: "Perawat", employeeId: "pat-1" },
  "dokter-oh": { name: "dr. Hendra", title: "Dokter OH", employeeId: "pat-1" },
  apoteker: { name: "Apoteker Satu", title: "Apoteker", employeeId: "pat-1" },
  hr: { name: "HR PIC", title: "HR/PIC", employeeId: "pat-1" },
  hse: { name: "HSE Officer", title: "HSE Officer", employeeId: "pat-1" },
  pekerja: { name: "Budi Test", title: "Operator", employeeId: "pat-1" },
};

/** Satu sesi browser per peran, dengan store yang sudah terisi. */
async function openRoleSession(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const user = {
    id: "u-role",
    username: `demo.${role}`,
    name: ROLE_USERS[role].name,
    password: "",
    role,
    title: ROLE_USERS[role].title,
    employeeId: ROLE_USERS[role].employeeId,
    mfaEnabled: false,
    preferredLanguage: "id",
  };
  await context.addInitScript(
    ([seeded]) => {
      window.localStorage.setItem(
        "kodein-klinik-store",
        JSON.stringify({ state: { currentUserId: seeded.id, users: [seeded] }, version: 0 })
      );
      window.localStorage.setItem(
        "emr-demo-role",
        JSON.stringify({ state: { role: "SYSTEM_ADMIN", enabled: false }, version: 0 })
      );
      // Cakupan organisasi yang sudah di-resolve pada sesi ini (di produksi
      // diisi `resolveScope()` setelah login). Tanpa ini aksi yang butuh scope
      // site (mis. dispensing apoteker) berhenti di guard cakupan.
      window.localStorage.setItem(
        "kodein_org_scope",
        JSON.stringify({
          organizationId: "org-1",
          orgUnitId: "unit-1",
          siteId: "site-1",
          siteCode: "HQ",
          siteName: "HQ",
          orgName: "Klinik Demo",
        })
      );
    },
    [user]
  );
  // Middleware server menolak request tanpa cookie sesi
  // (`kodein-klinik-store` berisi currentUserId) — tanpa ini semua route
  // internal dialihkan ke /login sebelum React sempat berjalan.
  await context.addCookies([
    {
      name: "kodein-klinik-store",
      value: encodeURIComponent(JSON.stringify({ state: { currentUserId: user.id } })),
      url: BASE,
    },
  ]);

  const calls = new Map();
  await context.route("**/api/v1/**", makeApiStub(calls));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, calls, errors };
}

/** Penghitung langkah pengguna: klik, ketik, dan tombol yang ditekan. */
function makeCounter() {
  let steps = 0;
  return {
    async click(locator, label) {
      steps += 1;
      await locator.click({ timeout: 15000 });
      if (label) console.log(`     · langkah ${steps}: ${label}`);
    },
    async type(locator, text) {
      steps += 1;
      await locator.fill(text, { timeout: 15000 });
      if (text) console.log(`     · langkah ${steps}: ketik "${text}"`);
    },
    async press(locator, key) {
      steps += 1;
      await locator.press(key);
      console.log(`     · langkah ${steps}: tekan ${key}`);
    },
    async select(locator, value, label) {
      steps += 1;
      if (typeof value === "number") await locator.selectOption({ index: value }, { timeout: 15000 });
      else await locator.selectOption(value, { timeout: 15000 });
      console.log(`     · langkah ${steps}: ${label}`);
    },
    get value() {
      return steps;
    },
  };
}

// ---------------------------------------------------------------------------
// Skenario utama per peran
// ---------------------------------------------------------------------------
/** Nilai TTV yang dipakai skenario TTV (dalam rentang wajar). */
const NORMAL_VITALS = {
  "Sistolik (mmHg)": "120",
  "Diastolik (mmHg)": "80",
  "Heart Rate (bpm)": "78",
  "Suhu (°C)": "36.8",
  "Tinggi Badan (cm)": "172",
  "Berat Badan (kg)": "70",
};

/** Admin Klinik: daftarkan kunjungan + catat TTV sampai tersimpan di backend. */
async function scenarioAdminKlinik(page, count, calls) {
  await page.goto(`${BASE}/visits/new`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const next = () => page.getByRole("button", { name: /^Lanjut$/ });
  await count.select(page.getByLabel("Pasien"), 1, "pilih pasien");
  await count.click(next(), "lanjut ke lokasi");
  await count.select(page.getByLabel("Lokasi"), 1, "pilih lokasi");
  await count.click(next(), "lanjut ke keluhan");
  await count.type(page.getByLabel("Keluhan Utama"), "Demam tiga hari");
  await count.click(next(), "lanjut ke TTV");
  for (const [label, value] of Object.entries(NORMAL_VITALS)) {
    await count.type(page.getByLabel(label), value);
  }
  await count.click(next(), "lanjut ke ringkasan");
  await count.click(
    page.getByRole("button", { name: /Simpan Kunjungan|Submit/i }).first(),
    "simpan kunjungan"
  );
  await page.waitForTimeout(1500);

  check(
    "SC-admin-klinik",
    "Admin Klinik: daftar kunjungan + TTV tersimpan ke backend",
    calls.has("POST /clinic/encounters") && calls.has("PUT /clinic/encounters/enc-1/vitals"),
    `calls=${[...calls.keys()].join(", ")}`
  );
}

/** Perawat: panggil pasien berikutnya — satu klik dari halaman antrean. */
async function scenarioPerawat(page, count, calls) {
  await page.goto(`${BASE}/visits/queue`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const button = page.getByRole("button", { name: /Panggil berikutnya/i });
  await button.waitFor({ state: "visible", timeout: 15000 });
  await count.click(button, "panggil berikutnya");
  await page.waitForTimeout(1500);
  check(
    "SC-perawat",
    "Perawat: panggil pasien berikutnya dari antrean",
    calls.has("POST /clinic/queues/call"),
    `calls=${[...calls.keys()].join(", ")}`
  );
}

/** Dokter: SOAP + ICD-10 cepat + autosave draft + simpan. */
async function scenarioDokter(page, count, calls) {
  await page.goto(`${BASE}/medical-records`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await count.click(page.getByRole("button", { name: /^SOAP$/ }).first(), "buka form SOAP");
  await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 10000 });

  // Riwayat ringkas pasien harus terlihat tanpa membuka halaman lain.
  const dialogText = await page.getByRole("dialog").first().innerText();
  check(
    "SC-dokter-riwayat",
    "Dokter: riwayat ringkas pasien tampil di dalam form SOAP",
    /Riwayat Budi Test/i.test(dialogText),
    dialogText.split("\n").find((l) => /Riwayat/i.test(l)) ?? "tidak ada"
  );

  await count.type(page.getByPlaceholder("Keluhan utama..."), "Demam tiga hari");

  // Pencarian ICD-10 cepat: ketik kode lalu Enter.
  const icd = page.getByRole("combobox");
  await count.type(icd, "E11");
  await count.press(icd, "Enter");
  await page.waitForTimeout(400);
  const icdPicked = await page.getByRole("dialog").first().innerText();
  check(
    "SC-dokter-icd",
    "Dokter: pencarian ICD-10 memilih diagnosis dengan keyboard",
    /E11/.test(icdPicked)
  );

  // Autosave draft: setelah menunggu debounce, draft tersimpan di perangkat.
  await page.waitForTimeout(1200);
  const hasDraft = await page.evaluate(() =>
    Object.keys(window.localStorage).some((k) => k.startsWith("emr-soap-draft:"))
  );
  check("SC-dokter-draft", "Dokter: draft SOAP tersimpan otomatis", hasDraft);

  await count.click(page.getByRole("button", { name: /Simpan SOAP/i }), "simpan SOAP");
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  check(
    "SC-dokter-simpan",
    "Dokter: SOAP tersimpan ke backend",
    calls.has("PUT /clinic/encounters/enc-1/soap") && /SOAP tersimpan/i.test(body),
    `calls=${[...calls.keys()].join(", ")}`
  );
}

/** Apoteker: peringatan stok/FEFO terlihat, lalu dispensing diproses. */
async function scenarioApoteker(page, count, calls) {
  await page.goto(`${BASE}/medicine/dispense`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  await count.click(page.getByRole("button", { name: /^Dispense$/ }).first(), "buka resep");
  const dialog = page.getByRole("dialog").first();
  await dialog.waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(600);

  const bannerText = await dialog.innerText();
  check(
    "SC-apoteker-warning",
    "Apoteker: peringatan stok & FEFO tampil sebelum memproses",
    /Stok: 12/.test(bannerText) && /FEFO/.test(bannerText),
    bannerText.split("\n").find((l) => /Stok:/.test(l)) ?? "tidak ada"
  );

  // Minta jumlah melebihi stok → transaksi harus diblokir di UI.
  const qty = dialog.getByRole("spinbutton").first();
  await count.type(qty, "999");
  await page.waitForTimeout(400);
  const blockedText = await dialog.innerText();
  const processBtn = dialog.getByRole("button", { name: /Proses Dispensing/i });
  const disabled = await processBtn.isDisabled();
  check(
    "SC-apoteker-blokir",
    "Apoteker: stok tidak cukup memblokir tombol proses (bukan gagal di backend)",
    /tidak cukup/i.test(blockedText) && disabled
  );

  await count.type(qty, "2");
  await page.waitForTimeout(400);
  await count.click(processBtn, "proses dispensing");
  await page.waitForTimeout(2200);
  // Pesan di modal dipakai sebagai keterangan bila transaksi tidak terkirim.
  const afterText = (await dialog.count()) > 0 ? await dialog.innerText() : "";
  const messageLine = afterText.split("\n").find((l) => /gagal|tidak|berhasil|berjalan/i.test(l));
  check(
    "SC-apoteker-dispense",
    "Apoteker: dispensing diproses backend",
    calls.has("POST /pharmacy/dispensing"),
    messageLine ?? `calls=${[...calls.keys()].join(", ")}`
  );
}

/** HR/PIC: dari dashboard ke daftar MCU jatuh tempo, dan filter tetap tersimpan. */
async function scenarioHr(page, count) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Nama ini juga dipakai kartu angka (aria-label) → ambil tautan tindakan cepat
  // pertama (urutan tugas), bukan kartu.
  const action = page.getByRole("link", { name: /MCU jatuh tempo/i }).first();
  await action.waitFor({ state: "visible", timeout: 15000 });
  await count.click(action, "tindakan cepat: MCU jatuh tempo");
  await page.waitForURL(/health-status/, { timeout: 15000 });
  await page.waitForTimeout(1500);

  const toggle = page.getByRole("button", { name: /Jatuh tempo/i });
  const pressed = (await toggle.getAttribute("aria-pressed")) === "true";
  const text = await page.evaluate(() => document.body.innerText);
  check(
    "SC-hr-due-soon",
    "HR/PIC: satu klik membuka daftar MCU jatuh tempo (MCU due-soon)",
    pressed && /Budi Test/.test(text) && !/Sari Sehat/.test(text),
    `url=${page.url()}`
  );

  // Filter tersimpan: buka ulang halaman tanpa query → filter tetap aktif.
  await page.goto(`${BASE}/health-status`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const persisted = (await page.getByRole("button", { name: /Jatuh tempo/i }).getAttribute("aria-pressed")) === "true";
  check("SC-hr-filter-tersimpan", "HR/PIC: filter tetap tersimpan saat halaman dibuka ulang", persisted);
}

/** HSE: pantau restriction — satu klik dari dashboard. */
async function scenarioHse(page, count) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const action = page.getByRole("link", { name: /Status kesehatan/i }).first();
  await count.click(action, "tindakan cepat: status kesehatan");
  await page.waitForURL(/health-status/, { timeout: 15000 });
  await page.waitForTimeout(1500);

  await count.click(page.getByRole("button", { name: /Ada restriction/i }), "filter restriction");
  await page.waitForTimeout(600);
  const text = await page.evaluate(() => document.body.innerText);
  check(
    "SC-hse-restriction",
    "HSE: filter restriction menampilkan hanya pekerja dengan restriksi",
    /Budi Test/.test(text) && !/Sari Sehat/.test(text)
  );
}

/** Pekerja: status kesehatan sendiri terlihat tanpa mencari menu. */
async function scenarioPekerja(page, count) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const tile = page.locator('[data-tile="myFitStatus"]');
  const dashboardText = await page.evaluate(() => document.body.innerText);
  check(
    "SC-pekerja-status",
    "Pekerja: status FTW terlihat langsung di dashboard",
    /Status FTW saya/i.test(dashboardText) && /Fit with Restriction/i.test(dashboardText),
    (await tile.count()) > 0 ? "kartu FTW ada" : "kartu FTW tidak ditemukan"
  );

  await count.click(
    page.getByRole("link", { name: /Status kesehatan saya/i }).first(),
    "tindakan cepat: status kesehatan saya"
  );
  await page.waitForURL(/\/my\/mcu/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const myText = await page.evaluate(() => document.body.innerText);
  check(
    "SC-pekerja-mcu",
    "Pekerja: satu klik membuka status kesehatan & riwayat MCU",
    /Status Kesehatan Kerja Saat Ini/i.test(myText)
  );
}

const SCENARIOS = {
  "admin-klinik": scenarioAdminKlinik,
  perawat: scenarioPerawat,
  "dokter-oh": scenarioDokter,
  apoteker: scenarioApoteker,
  hr: scenarioHr,
  hse: scenarioHse,
  pekerja: scenarioPekerja,
};

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  const filter = process.env.ROLE_FILTER?.split(",").map((s) => s.trim()).filter(Boolean);
  const roles = (filter && filter.length > 0 ? filter : Object.keys(SCENARIOS)).filter(
    (r) => SCENARIOS[r]
  );

  const summary = [];
  try {
    for (const role of roles) {
      console.log(`\n[role] ${role} …`);
      const { context, page, calls, errors } = await openRoleSession(browser, role);
      const count = makeCounter();
      try {
        // Urutan argumen: page, penghitung langkah, pencatat request backend.
        await SCENARIOS[role](page, count, calls);
        const failed = results.filter((r) => r.id.startsWith(`SC-${role}`) && !r.pass);
        summary.push({ role, steps: count.value, budget: ROLE_BUDGET[role], failed: failed.length, errors });
        check(
          `SC-${role}-langkah`,
          `Anggaran langkah ${role} (≤ ${ROLE_BUDGET[role]})`,
          count.value <= ROLE_BUDGET[role] && errors.length === 0,
          `langkah=${count.value}`
        );
      } catch (e) {
        summary.push({ role, steps: count.value, budget: ROLE_BUDGET[role], failed: 1, errors });
        check(`SC-${role}`, `Skenario ${role} berjalan tanpa error`, false, String(e).slice(0, 200));
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\nRingkasan skenario per peran:");
  for (const row of summary) {
    console.log(
      `  ${row.failed === 0 ? "✓" : "✗"} ${row.role.padEnd(14)} langkah=${row.steps}/${row.budget}`
    );
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan PASS`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error("ROLE SCENARIO ERROR:", e);
  process.exitCode = 2;
});
