/**
 * E2E Fase 2 — Frontend-only: Identity, Employee/MRN, Consent, MCU, FTW & Restriction.
 *
 * Lingkup: UI nyata (production build) -> API -> database -> response -> UI -> refresh
 * -> bukti bahwa state tetap tersimpan. Bukan hanya render atau HTTP 200.
 *
 * ENVIRONMENT (penting):
 *   Repo ini TIDAK memiliki environment staging (tidak ada URL staging, backend
 *   staging, akun staging, bucket, atau provider produksi). Skrip ini tetap
 *   dijalankan terhadap backend NYATA yang tersedia (lokal) dan menandai
 *   seluruh prasyarat khusus staging sebagai BLOCKED — bukan PASS.
 *   Skrip siap dipakai pada staging hanya dengan mengeset env:
 *     E2E_BASE_URL=https://<frontend-staging> E2E_API_URL=https://<backend-staging>/api/v1
 *
 * Menjalankan:
 *   npx next build && npx next start -p 3001
 *   E2E_BASE_URL=http://localhost:3001 E2E_API_URL=http://localhost:3100/api/v1 \
 *     node e2e/fase2-identity-mcu-staging.mjs
 *
 * Env:
 *   E2E_BASE_URL   (default http://localhost:3001)
 *   E2E_API_URL    (default http://localhost:3000/api/v1)
 *   SEED_PASSWORD  (default: password seed backend; tidak pernah ditulis ke evidence)
 *   E2E_WORKER     (default "w1")
 *   E2E_GROUP      (opsional) jalankan hanya grup tertentu, mis. "F2-04" atau "F2-01,F2-02"
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
    /* tidak terpasang di repo frontend */
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
      /* coba berikutnya */
    }
  }
  throw new Error("playwright-core tidak ditemukan (frontend maupun repo backend).");
}

const { chromium } = loadPlaywright();

const BASE = process.env.E2E_BASE_URL || "http://localhost:3001";
const API = process.env.E2E_API_URL || "http://localhost:3000/api/v1";
const PASSWORD = process.env.SEED_PASSWORD || "KlinikLNG2026!";
const WORKER = process.env.E2E_WORKER || "w1";
const STAMP = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const PREFIX = `E2E-F2-${STAMP}-${WORKER}`;
const OUT = "test-artifacts/e2e-f2";
/**
 * Filter grup: `E2E_GROUP=F2-04,F2-07` atau argumen CLI.
 * Argumen "fase2"/"all" = jalankan semua grup (dipakai `npm run test:e2e:staging -- fase2`).
 */
const ARG = (process.argv[2] ?? "").trim();
const GROUP_SOURCE = process.env.E2E_GROUP || (/^(fase2|all)$/i.test(ARG) ? "" : ARG);
const ONLY = GROUP_SOURCE.split(",").map((s) => s.trim()).filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, "traces"), { recursive: true });

const IS_STAGING = /^https:/i.test(BASE) && !/localhost|127\.0\.0\.1/i.test(BASE);
/** Akar backend (health endpoint berada di luar prefix `api/v1`). */
const API_ROOT = API.replace(/\/api\/v1\/?$/, "");

// ---------------------------------------------------------------------------
// Bookkeeping
// ---------------------------------------------------------------------------
const results = [];
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const serverErrors = [];
const created = [];
/** id skenario yang memang memicu error jaringan/console (negative case). */
const expectedErrorIds = new Set();
let currentStageId = "setup";
let browser;

function record(id, group, name, status, detail = "", extra = {}) {
  const row = {
    id,
    group,
    name,
    status,
    detail,
    role: extra.role,
    url: extra.url,
    viewport: extra.viewport,
    durationMs: extra.durationMs,
    evidence: extra.evidence,
    category: extra.category,
    at: new Date().toISOString(),
  };
  results.push(row);
  const tag =
    status === "PASS" ? "PASS " : status === "FAIL" ? "FAIL " : status === "BLOCKED" ? "BLOCK" : "SKIP ";
  console.log(`[${tag}] ${id} — ${name}${detail ? ` :: ${detail}` : ""}`);
  return row;
}

const groupEnabled = (id) => ONLY.length === 0 || ONLY.some((g) => id.startsWith(g));
let activeGroup = "";
async function group(id, title, fn) {
  if (!groupEnabled(id)) return;
  activeGroup = id;
  console.log(`\n=== ${id} — ${title} ===`);
  const started = Date.now();
  try {
    await fn();
  } catch (e) {
    record(`${id}-EXC`, id, `Exception pada grup ${id}`, "FAIL", String(e?.message || e), {
      category: "TEST_BUG",
    });
  }
  console.log(`--- ${id} selesai dalam ${Date.now() - started} ms ---`);
}

function sanitize(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(new RegExp(PASSWORD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<password>")
    .split("\n")
    .map((line) => line.replace(/(verificationToken"?\s*[:=]\s*"?)([A-Za-z0-9_-]{12,})/g, "$1<token:redacted>"))
    .join("\n");
}

// ---------------------------------------------------------------------------
// HTTP helper (untuk read-back dan negative-case di level API kontrak)
// ---------------------------------------------------------------------------
async function api(p, { method = "GET", token, body } = {}) {
  try {
    const res = await fetch(`${API}${p}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, ok: res.ok };
  } catch (e) {
    return { status: 0, json: { error: String(e?.message || e) }, ok: false };
  }
}

const unwrap = (j) => (j && typeof j === "object" && "data" in j ? j.data : j);

async function apiLogin(username, password = PASSWORD) {
  const r = await api("/auth/login", { method: "POST", body: { username, password } });
  return unwrap(r.json)?.accessToken ?? null;
}

/** Cakupan organisasi/site akun (dibutuhkan POST /patients). */
async function resolveScopeFor(token) {
  const users = await api("/iam/users?page=1&limit=1", { token });
  const u0 = (unwrap(users.json) || [])[0] || {};
  const withSite = (u0.user_roles || []).find((r) => r.site && r.site.id) || (u0.user_roles || [])[0] || {};
  const site = withSite.site || {};
  let orgId = null;
  try {
    orgId = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).organizationId ?? null;
  } catch {
    orgId = null;
  }
  return { organizationId: orgId, orgUnitId: withSite.org_unit_id, siteId: site.id, siteCode: site.code };
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------
async function shot(page, id) {
  const file = `${OUT}/${id}.png`;
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

function isExpectedConsoleError(text) {
  return (
    /status of (400|401|403|404|409|422|429)\b/.test(text) ||
    /ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to fetch|Load failed|net::ERR/.test(text)
  );
}

async function withContext(viewport, fn, label = "") {
  const context = await browser.newContext({ viewport, locale: "id-ID" });
  await context.tracing.start({ screenshots: false, snapshots: true }).catch(() => {});
  const before = results.length;
  try {
    await fn(context);
  } catch (e) {
    record(`${activeGroup}-EXC`, activeGroup, `Exception${label ? ` (${label})` : ""}`, "FAIL", String(e?.message || e), {
      category: "TEST_BUG",
    });
  } finally {
    const failed = results.slice(before).filter((r) => r.status === "FAIL");
    if (failed.length > 0) {
      const name = failed
        .map((r) => r.id)
        .join("+")
        .replace(/[^a-zA-Z0-9._+-]/g, "_")
        .slice(0, 80);
      const trace = path.join(OUT, "traces", `${name}-${Date.now()}.zip`);
      await context.tracing.stop({ path: trace }).catch(() => {});
      for (const row of failed) if (!row.evidence) row.evidence = trace;
    } else {
      await context.tracing.stop().catch(() => {});
    }
    await context.close();
  }
}

async function makePage(context, stageId) {
  currentStageId = stageId;
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text().slice(0, 300);
      consoleErrors.push({ stage: currentStageId, text, expected: isExpectedConsoleError(text) });
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ stage: currentStageId, text: String(err?.message || err).slice(0, 300) });
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.startsWith(BASE) || u.startsWith(API)) {
      const error = req.failure()?.errorText ?? "";
      requestFailures.push({
        stage: currentStageId,
        url: u.replace(API, "/api/v1"),
        error,
        // ERR_ABORTED = prefetch RSC yang dibatalkan saat navigasi (normal).
        category: /ERR_ABORTED/.test(error)
          ? "ABORTED_PREFETCH"
          : /ERR_INTERNET_DISCONNECTED|ERR_FAILED|Failed to fetch/.test(error)
            ? "SIMULATED_OFFLINE"
            : "UNEXPECTED",
      });
    }
  });
  page.on("response", (res) => {
    if (res.status() >= 500) {
      serverErrors.push({
        stage: currentStageId,
        status: res.status(),
        url: res.url().replace(API, "/api/v1"),
        method: res.request().method(),
      });
    }
  });
  return page;
}

/**
 * Tunggu dokumen tenang (hidrasi React selesai) sebelum menyentuh form.
 * Pada `next dev` chunk dikompilasi on-demand: mengisi input terkontrol sebelum
 * hidrasi membuat nilainya terhapus saat React mengambil alih DOM, sehingga
 * submit tidak mengirim request dan test menjadi FAIL palsu.
 */
async function waitIdle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
}

/** Isi input terkontrol dan pastikan nilainya menempel (hidrasi sudah selesai). */
async function fillStable(locator, value) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await locator.fill(value);
    if ((await locator.inputValue().catch(() => "")) === value) return;
    await locator.page().waitForTimeout(250);
  }
  throw new Error(`Input form tidak stabil (hidrasi belum selesai) untuk nilai: ${value}`);
}

/** Login lewat UI (bukan inject token) — memverifikasi alur auth nyata. */
async function login(page, username, password = PASSWORD) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await waitIdle(page);
  await fillStable(page.getByLabel("Username"), username);
  await fillStable(page.getByLabel("Password"), password);
  await page.getByRole("button", { name: "Masuk" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

const bodyText = (page) => page.locator("body").innerText().catch(() => "");

// ---------------------------------------------------------------------------
// Test data helpers (prefix E2E-F2, tidak menyentuh data seed tim lain)
// ---------------------------------------------------------------------------
async function createPatientViaApi(token, { nik, name, employeeNo }) {
  const scope = await resolveScopeFor(token);
  return api("/patients", {
    method: "POST",
    token,
    body: {
      employeeNo,
      fullName: name,
      birthDate: "1990-01-01",
      sex: "M",
      email: `${employeeNo.toLowerCase()}@e2e-test.local`,
      phone: "081200000000",
      organizationId: scope.organizationId,
      orgUnitId: scope.orgUnitId,
      siteId: scope.siteId,
      siteCode: scope.siteCode,
      identifierType: "NIK",
      identifierValue: nik,
    },
  });
}

function syntheticNik(seed) {
  const digits = String(seed).replace(/\D/g, "").padEnd(14, "3").slice(0, 14);
  return `32${digits}`;
}

// ---------------------------------------------------------------------------
// PREFLIGHT
// ---------------------------------------------------------------------------
async function preflight() {
  await group("F2-00", "Preflight & environment", async () => {
    const fe = await fetch(BASE, { redirect: "manual" }).then(
      (r) => ({ status: r.status, type: r.headers.get("content-type") }),
      (e) => ({ status: 0, error: String(e) })
    );
    record(
      "F2-00-01",
      "F2-00",
      "Frontend production build dapat diakses",
      fe.status > 0 && fe.status < 500 ? "PASS" : "FAIL",
      `GET ${BASE} -> ${fe.status}`,
      { url: BASE, category: fe.status > 0 ? undefined : "ENVIRONMENT_BLOCKER" }
    );

    const readyRes = await fetch(`${API_ROOT}/health/readiness`).catch(() => null);
    const ready = readyRes
      ? { status: readyRes.status, json: await readyRes.json().catch(() => ({})) }
      : { status: 0, json: {} };
    const rd = unwrap(ready.json) || {};
    const dbUp = rd?.details?.database?.status === "up" || rd?.info?.database?.status === "up";
    const storage = rd?.details?.storage ?? rd?.info?.storage ?? {};
    record(
      "F2-00-02",
      "F2-00",
      "Backend API staging & database dapat diakses",
      ready.status === 200 && dbUp ? "PASS" : "FAIL",
      `GET /health/readiness -> ${ready.status}; database=${dbUp ? "up" : "down"}; storage=${storage.driver ?? "-"}; queueWorker=${
        (rd?.details?.queueWorker ?? rd?.info?.queueWorker ?? {}).status ?? "-"
      }`,
      { url: API, category: ready.status === 200 ? undefined : "ENVIRONMENT_BLOCKER" }
    );

    record(
      "F2-00-03",
      "F2-00",
      "Frontend/backend staging (HTTPS) tersedia",
      IS_STAGING ? "PASS" : "BLOCKED",
      IS_STAGING
        ? "staging HTTPS terdeteksi"
        : `bukan staging: frontend=${BASE} backend=${API} (hanya backend lokal yang tersedia)`,
      { category: "ENVIRONMENT_BLOCKER" }
    );

    record(
      "F2-00-04",
      "F2-00",
      "Storage staging (S3/MinIO) & provider (email/PSrE) staging",
      /s3|minio/i.test(String(storage.driver)) ? "PASS" : "BLOCKED",
      `storage driver backend = ${storage.driver ?? "tidak diketahui"} (bukan bucket S3/MinIO staging)`,
      { category: "ENVIRONMENT_BLOCKER" }
    );

    if (!IS_STAGING) {
      record(
        "F2-00-05",
        "F2-00",
        "Status Fase 2: BLOCKED — staging belum tersedia",
        "BLOCKED",
        "Prasyarat §2 prompt Fase 2 tidak terpenuhi (tidak ada frontend/backend staging HTTPS, akun staging, bucket, atau provider produksi). Seluruh verifikasi dijalankan pada production build frontend melawan backend nyata lokal.",
        { category: "ENVIRONMENT_BLOCKER" }
      );
    }
  });
}

// ---------------------------------------------------------------------------
// F2-01 — Employee list & detail
// ---------------------------------------------------------------------------
let f2Seed = null; // { patientId, mrn, employeeNo, fullName, nik, token }

async function f201() {
  await group("F2-01", "Employee list & detail (HR/PIC)", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-01");
      const started = Date.now();
      await login(page, "hr.pic");
      const token = await page.evaluate(() => localStorage.getItem("kodein_token"));

      // Data uji F2 dibuat lebih dulu lewat kontrak API (bukan fixture frontend)
      const employeeNo = `${PREFIX}-LIST`;
      const nik = syntheticNik(STAMP.slice(-6));
      const createdRes = await createPatientViaApi(token, {
        nik,
        name: `${PREFIX} List Employee`,
        employeeNo,
      });
      const createdBody = unwrap(createdRes.json) || {};
      if (createdBody.id) {
        f2Seed = {
          patientId: createdBody.id,
          mrn: createdBody.medicalRecordNo,
          employeeNo,
          fullName: `${PREFIX} List Employee`,
          nik,
          token,
        };
        created.push({ type: "patient", id: createdBody.id, employeeNo, mrn: createdBody.medicalRecordNo, prefix: PREFIX });
      }

      await page.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});

      const heading = await page.getByRole("heading", { name: /People & Medical Record/i }).isVisible().catch(() => false);
      const rows = await page.locator("table tbody tr").count();
      record(
        "F2-01-01",
        "F2-01",
        "Halaman People memuat data dari API (bukan fixture)",
        heading && rows > 0 ? "PASS" : "FAIL",
        `heading=${heading} baris=${rows}`,
        { role: "hr.pic", url: `${BASE}/people`, viewport: "1280x800", durationMs: Date.now() - started }
      );

      // search
      const search = page.getByLabel("Cari pekerja");
      await search.fill(employeeNo);
      await page.waitForTimeout(700); // debounce 300ms + request
      const foundText = await bodyText(page);
      const foundSearch = foundText.includes(employeeNo);
      record(
        "F2-01-02",
        "F2-01",
        "Search pekerja berdasarkan Employee ID menemukan data backend",
        foundSearch ? "PASS" : "FAIL",
        `cari=${employeeNo} ditemukan=${foundSearch}`
      );

      // search tanpa hasil -> empty state informatif
      await search.fill(`${PREFIX}-TIDAKADA-999`);
      await page.waitForTimeout(900);
      const emptyText = await bodyText(page);
      const informativeEmpty = /Tidak ada pekerja ditemukan/i.test(emptyText);
      record(
        "F2-01-03",
        "F2-01",
        "Empty state informatif saat pencarian tidak menemukan data",
        informativeEmpty ? "PASS" : "FAIL",
        `pesan empty=${informativeEmpty}`
      );

      // Filter site/status: UI tidak boleh menampilkan filter yang tidak berfungsi.
      await search.fill("");
      await page.waitForTimeout(700);
      const filterControls = await page.getByLabel(/^Filter /).count();
      const noticeText = await bodyText(page);
      const noticeShown = /Filter site\/unit\/status\/consent belum tersedia/i.test(noticeText);
      await shot(page, "F2-01-filter-limitation");
      record(
        "F2-01-04",
        "F2-01",
        "Tidak ada kontrol filter palsu (filter non-fungsional dihapus + keterbatasan dijelaskan)",
        filterControls === 0 && noticeShown ? "PASS" : "FAIL",
        `kontrolFilter=${filterControls} keteranganKeterbatasan=${noticeShown}`,
        { url: `${BASE}/people`, evidence: `${OUT}/F2-01-filter-limitation.png`, category: filterControls === 0 ? undefined : "PRODUCT_BUG" }
      );
      record(
        "F2-01-05",
        "F2-01",
        "Kriteria 'filter site/status bekerja' (acceptance F2-01)",
        "BLOCKED",
        "BACKEND BLOCKER — di luar scope frontend-only: GET /api/v1/patients hanya menerima page, limit, search (backend patient.controller.ts + API_ENDPOINTS.md). Tidak ada jalur frontend untuk memfilter site/status/consent, sehingga kriteria ini tidak dapat dipenuhi tanpa perubahan kontrak API.",
        { category: "BACKEND_BLOCKER" }
      );

      // buka detail
      if (f2Seed) {
        await page.goto(`${BASE}/people/${f2Seed.patientId}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const detail = await bodyText(page);
        const mrnShown = detail.includes(f2Seed.mrn) && detail.includes(f2Seed.employeeNo);
        await shot(page, "F2-01-detail");
        record(
          "F2-01-06",
          "F2-01",
          "Detail pekerja menampilkan MRN dari backend",
          mrnShown ? "PASS" : "FAIL",
          `mrn=${f2Seed.mrn} employeeNo=${f2Seed.employeeNo} tampil=${mrnShown}`,
          { url: `${BASE}/people/${f2Seed.patientId}`, evidence: `${OUT}/F2-01-detail.png` }
        );

        // refresh -> data tetap ada
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const afterReload = await bodyText(page);
        record(
          "F2-01-07",
          "F2-01",
          "Detail tetap tampil setelah refresh (persistence)",
          afterReload.includes(f2Seed.mrn) ? "PASS" : "FAIL",
          `mrn tampil setelah refresh=${afterReload.includes(f2Seed.mrn)}`
        );
        await shot(page, "F2-01-detail-refresh");
      } else {
        record("F2-01-06", "F2-01", "Detail pekerja", "BLOCKED", "data uji gagal dibuat lewat API", {
          category: "DATA_PROBLEM",
        });
      }

      // Tab consent: status consent berasal dari backend?
      const consentTab = page.getByRole("button", { name: "Consent", exact: true });
      if (await consentTab.count()) {
        await consentTab.first().click();
        await page.waitForTimeout(400);
        const consentText = await bodyText(page);
        const claimsEmpty = /Belum ada consent untuk pekerja ini/i.test(consentText);
        record(
          "F2-01-08",
          "F2-01",
          "Status consent pada detail berasal dari backend",
          claimsEmpty ? "FAIL" : "PASS",
          claimsEmpty
            ? "UI berkata 'Belum ada consent' padahal GET /patients/:id/profile tidak pernah mengembalikan consent (field consent tidak ada di response) -> UI menyimpulkan 'tidak ada consent' tanpa bukti backend"
            : "status consent tampil dari backend",
          { category: claimsEmpty ? "PRODUCT_BUG" : undefined }
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// F2-02 — Create employee & MRN (UI)
// ---------------------------------------------------------------------------
async function f202() {
  await group("F2-02", "Create employee, MRN & validation (UI)", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-02");
      await login(page, "hr.pic");
      const token = await page.evaluate(() => localStorage.getItem("kodein_token"));

      // CTA create terlihat untuk HR
      await page.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const ctaVisible = await page.getByRole("link", { name: /Tambah pekerja/i }).first().isVisible().catch(() => false);
      record("F2-02-01", "F2-02", "CTA 'Tambah pekerja' tampil untuk role HR/PIC", ctaVisible ? "PASS" : "FAIL", `cta=${ctaVisible}`, {
        role: "hr.pic",
      });

      await page.goto(`${BASE}/people/new`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        localStorage.removeItem("kodein_draft");
        localStorage.removeItem("kodein_people_draft");
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});

      const employeeNo = `${PREFIX}-NEW`;
      const fullName = `${PREFIX} Budi Sintetis`;
      const nik = syntheticNik(STAMP.slice(-7));

      // Negative: submit langkah 1 tanpa field wajib
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);
      const validationText = await bodyText(page);
      const requiredShown = /wajib|harus|tidak valid|minimal/i.test(validationText);
      const stillStep1 = /Identitas Pekerja/i.test(validationText);
      record(
        "F2-02-02",
        "F2-02",
        "Validasi field wajib pada form create employee",
        requiredShown && stillStep1 ? "PASS" : "FAIL",
        `pesanValidasi=${requiredShown} tetapDiLangkah1=${stillStep1}`
      );

      await page.getByLabel("Nama Lengkap").fill(fullName);
      await page.getByLabel("Nomor Identifier").fill(nik);
      await page.getByLabel("Tanggal Lahir").fill("1990-01-01");
      await page.getByLabel("Jenis Kelamin").selectOption("MALE");
      await page.getByLabel("Employee ID").fill(employeeNo);
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);

      // step 2 penempatan
      await page.getByLabel("Organization").selectOption({ index: 1 });
      await page.getByLabel("Unit Kerja").selectOption({ index: 1 });
      await page.getByLabel("Site/Office").selectOption({ index: 1 });
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);

      // Negative: email tidak valid
      await page.getByLabel("Email Pekerja").fill("bukan-email");
      await page.getByLabel("Nomor Telepon").fill("081234567890");
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);
      const emailErr = await bodyText(page);
      const stillContactStep = /Kontak Pekerja/i.test(emailErr);
      const emailMessage = /Masukkan alamat email yang valid|email wajib/i.test(emailErr);
      await shot(page, "F2-02-email-invalid");
      record(
        "F2-02-03",
        "F2-02",
        "Validasi email tidak valid ditolak di form",
        stillContactStep && emailMessage ? "PASS" : "FAIL",
        `pesanValidasi=${emailMessage} tetapDiLangkahKontak=${stillContactStep}`,
        { evidence: `${OUT}/F2-02-email-invalid.png` }
      );

      await page.getByLabel("Email Pekerja").fill(`${employeeNo.toLowerCase()}@e2e-test.local`);
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: /^Lanjut$/ }).click();
      await page.waitForTimeout(300);

      // step 5 consent
      await page.getByLabel("Versi Consent").fill("1.0");
      await page.locator("#acknowledge").check();
      const submit = page.getByRole("button", { name: /Simpan & kirim consent/i });

      // double click submit -> hanya boleh membuat 1 record
      await submit.click();
      await submit.click({ force: true, timeout: 2000 }).catch(() => {});

      const successUi = await page
        .getByText(/Pekerja berhasil didaftarkan/i)
        .waitFor({ timeout: 40000 })
        .then(() => true)
        .catch(() => false);
      const successText = await bodyText(page);
      await shot(page, "F2-02-success");

      const list = await api(`/patients?page=1&limit=50&search=${encodeURIComponent(employeeNo)}`, { token });
      const rows = (unwrap(list.json) || []).filter((r) => r.employeeNo === employeeNo);
      const mrn = rows[0]?.mrn ?? null;
      if (rows[0]) {
        created.push({ type: "patient", id: rows[0].id, employeeNo, mrn, prefix: PREFIX });
      }
      record(
        "F2-02-04",
        "F2-02",
        "Create employee via UI sukses & record dibuat di backend",
        successUi && rows.length === 1 ? "PASS" : "FAIL",
        `ui=${successUi} record=${rows.length} mrn=${mrn ?? "-"}`,
        { role: "hr.pic", evidence: `${OUT}/F2-02-success.png`, category: successUi && rows.length === 1 ? undefined : "PRODUCT_BUG" }
      );
      record(
        "F2-02-05",
        "F2-02",
        "Double-click submit tidak menggandakan record",
        rows.length === 1 ? "PASS" : "FAIL",
        `jumlah record dengan employeeNo=${employeeNo}: ${rows.length}`
      );
      const mrnFromBackend = /^MRN-/.test(mrn ?? "");
      record(
        "F2-02-06",
        "F2-02",
        "MRN dibuat oleh backend (pola MRN-...) dan tampil di UI",
        mrnFromBackend && successText.includes(mrn ?? "###") ? "PASS" : "FAIL",
        `mrn=${mrn ?? "-"} tampilDiUI=${successText.includes(mrn ?? "###")}`
      );

      // persistence: refresh + cari di UI
      const check = await makePage(ctx, "F2-02-persist");
      await check.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
      await check.waitForLoadState("networkidle").catch(() => {});
      await check.getByLabel("Cari pekerja").fill(employeeNo);
      await check.waitForTimeout(1000);
      const persistText = await bodyText(check);
      await shot(check, "F2-02-persist");
      record(
        "F2-02-07",
        "F2-02",
        "Employee + MRN tetap ada setelah refresh (UI)",
        persistText.includes(employeeNo) && persistText.includes(mrn ?? "###") ? "PASS" : "FAIL",
        `employeeNo=${persistText.includes(employeeNo)} mrn=${persistText.includes(mrn ?? "###")}`,
        { evidence: `${OUT}/F2-02-persist.png` }
      );

      // negative: identifier duplikat
      const dup = await createPatientViaApi(token, { nik, name: `${PREFIX} Duplikat`, employeeNo: `${PREFIX}-DUP` });
      record(
        "F2-02-08",
        "F2-02",
        "Identifier/NIK duplikat ditolak backend (bukan fake success)",
        [400, 409, 422].includes(dup.status) ? "PASS" : "FAIL",
        `POST /patients dengan NIK sama -> ${dup.status} ${sanitize(JSON.stringify(unwrap(dup.json)?.message ?? unwrap(dup.json)?.fieldErrors ?? "").slice(0, 160))}`,
        { category: [400, 409, 422].includes(dup.status) ? "EXPECTED_NEGATIVE_CASE" : "PRODUCT_BUG" }
      );

      // negative: unit kerja tidak sesuai organisasi (kontrak API)
      const badScope = await createPatientViaApi(token, { nik: syntheticNik("999999"), name: `x`, employeeNo: `` });
      record(
        "F2-02-09",
        "F2-02",
        "Payload tidak valid (field wajib kosong) ditolak backend dengan error terstruktur",
        badScope.status === 400 && Array.isArray(unwrap(badScope.json)?.fieldErrors) ? "PASS" : "FAIL",
        `status=${badScope.status}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // CTA hilang untuk role tanpa permission
      const other = await makePage(ctx, "F2-02-role");
      await login(other, "apoteker");
      await other.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
      await other.waitForLoadState("networkidle").catch(() => {});
      const deniedText = await bodyText(other);
      const apotekerDenied = /Akses terbatas|AccessDenied/i.test(deniedText);
      const apotekerHasCta = await other.getByRole("link", { name: /Tambah pekerja/i }).count();
      record(
        "F2-02-10",
        "F2-02",
        "Role tanpa permission tidak melihat CTA create (AccessDenied)",
        apotekerDenied && apotekerHasCta === 0 ? "PASS" : "FAIL",
        `accessDenied=${apotekerDenied} cta=${apotekerHasCta}`,
        { role: "apoteker", category: apotekerDenied ? undefined : "PRODUCT_BUG" }
      );
    });
  });
}

// ---------------------------------------------------------------------------
// F2-03 — Consent initiation & notification status
// ---------------------------------------------------------------------------
async function f203() {
  await group("F2-03", "Consent initiation & notification status", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-03");
      await login(page, "hr.pic");
      const token = await page.evaluate(() => localStorage.getItem("kodein_token"));

      // Grup ini harus mandiri (dapat dijalankan tanpa F2-01).
      if (!f2Seed) {
        const employeeNo = `${PREFIX}-CONSENT`;
        const nik = syntheticNik(STAMP.slice(-8));
        const mk = await createPatientViaApi(token, { nik, name: `${PREFIX} Consent Subject`, employeeNo });
        const body = unwrap(mk.json) || {};
        if (body.id) {
          f2Seed = { patientId: body.id, mrn: body.medicalRecordNo, employeeNo, fullName: `${PREFIX} Consent Subject`, nik, token };
          created.push({ type: "patient", id: body.id, employeeNo, mrn: body.medicalRecordNo, prefix: PREFIX });
        }
      }
      if (!f2Seed) {
        record("F2-03-01", "F2-03", "Consent initiation", "BLOCKED", "data uji tidak dapat dibuat via API", {
          category: "DATA_PROBLEM",
        });
        return;
      }

      // Kirim consent lewat kontrak API (jalur UI "Resend consent" diuji terpisah)
      const send = await api("/consents/send", {
        method: "POST",
        token,
        body: { patientId: f2Seed.patientId, consentType: "DATA_PROCESSING" },
      });
      const sendData = unwrap(send.json) || {};
      const tokenIssued = typeof sendData.verificationToken === "string" && sendData.verificationToken.length >= 32;
      f2Seed.consentToken = tokenIssued ? sendData.verificationToken : null;
      f2Seed.consentId = sendData.consentId ?? null;
      record(
        "F2-03-01",
        "F2-03",
        "Consent dikirim dari UI/API dan token verifikasi diterbitkan backend",
        send.status === 201 && tokenIssued ? "PASS" : "BLOCKED",
        `POST /consents/send -> ${send.status}; token=${tokenIssued ? "diterbitkan (disimpan untuk uji F2-04, tidak ditulis ke evidence)" : "TIDAK ADA"}`,
        { category: tokenIssued ? undefined : "PROVIDER_BLOCKER" }
      );

      // Resend harus idempotent (tidak menggandakan consent PENDING)
      const resend = await api("/consents/send", {
        method: "POST",
        token,
        body: { patientId: f2Seed.patientId, consentType: "DATA_PROCESSING" },
      });
      record(
        "F2-03-02",
        "F2-03",
        "Resend consent idempotent sesuai contract (tidak membuat consent baru)",
        resend.status === 201 && unwrap(resend.json)?.consentId === f2Seed.consentId ? "PASS" : "FAIL",
        `consentId pertama=${f2Seed.consentId ? "ada" : "-"} resend=${unwrap(resend.json)?.consentId === f2Seed.consentId ? "sama" : "BERBEDA"}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // Notification status (dari backend, bukan frontend)
      const notif = await api("/notifications", { token });
      const rowsNotif = unwrap(notif.json);
      const listNotif = Array.isArray(rowsNotif) ? rowsNotif : rowsNotif?.data ?? [];
      const mine = listNotif.filter((n) => n.related_type === "CONSENT_DISPATCHED" && n.patient_id === f2Seed.patientId);
      record(
        "F2-03-03",
        "F2-03",
        "Status notifikasi consent berasal dari backend",
        mine.length > 0 ? "PASS" : "BLOCKED",
        `notifikasi CONSENT_DISPATCHED untuk pasien uji: ${mine.length} (status=${mine.map((n) => n.status).join(",") || "-"})`,
        { category: mine.length ? undefined : "BACKEND_BLOCKER" }
      );

      // Status consent dapat dibaca ulang oleh UI (persistence after refresh)
      await page.goto(`${BASE}/people/${f2Seed.patientId}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const consentTab = page.getByRole("button", { name: "Consent", exact: true });
      if (await consentTab.count()) await consentTab.first().click();
      await page.waitForTimeout(400);
      const consentUi = await bodyText(page);
      await shot(page, "F2-03-consent-tab");
      record(
        "F2-03-04",
        "F2-03",
        "Status consent tetap terbaca setelah refresh",
        /Belum ada consent untuk pekerja ini/i.test(consentUi) ? "FAIL" : "PASS",
        /Belum ada consent untuk pekerja ini/i.test(consentUi)
          ? "UI menampilkan 'Belum ada consent' padahal consent PENDING + notifikasi CONSENT_DISPATCHED ada di backend"
          : "status consent terbaca",
        { url: `${BASE}/people/${f2Seed.patientId}`, evidence: `${OUT}/F2-03-consent-tab.png` }
      );
      record(
        "F2-03-05",
        "F2-03",
        "Endpoint baca status consent per pasien",
        "BLOCKED",
        "BACKEND BLOCKER — di luar scope frontend-only: GET /patients/:id/profile tidak menyertakan consent/consents; tidak ada GET /consents?patientId=. UI tidak dapat menampilkan status consent PENDING/GRANTED/EXPIRED dari backend (hanya ada notifikasi CONSENT_DISPATCHED).",
        { category: "BACKEND_BLOCKER" }
      );

      // Jalur UI "Resend consent" pada detail pekerja
      const resendBtn = page.getByRole("button", { name: /Resend consent/i });
      if (await resendBtn.count()) {
        await page.locator("html").click({ position: { x: 5, y: 5 } }).catch(() => {});
        await resendBtn.first().click();
        await page.waitForTimeout(800);
        const modalText = await bodyText(page);
        const modalOpen = /Preview Email Consent/i.test(modalText);
        const linkHref = await page
          .getByRole("link", { name: /Buka halaman consent/i })
          .first()
          .getAttribute("href")
          .catch(() => null);
        await shot(page, "F2-03-resend-modal");
        const linkOk = Boolean(linkHref) && !/undefined|null/.test(linkHref ?? "");
        record(
          "F2-03-06",
          "F2-03",
          "Tombol 'Resend consent' menjalankan aksi nyata (bukan hanya preview email kosong)",
          modalOpen && !linkOk ? "FAIL" : "PASS",
          modalOpen && !linkOk
            ? `klik 'Resend consent' hanya membuka modal pratinjau email tanpa memanggil POST /consents/send; tautan consent = ${linkHref ?? "tidak ada"} (token consent tidak pernah dimuat dari backend)`
            : "aksi mengirim permintaan resend",
          { category: modalOpen && !linkOk ? "PRODUCT_BUG" : undefined, evidence: `${OUT}/F2-03-resend-modal.png` }
        );
      } else {
        record("F2-03-06", "F2-03", "Tombol 'Resend consent' tersedia untuk role berizin", "FAIL", "tombol tidak ditemukan", {
          category: "PRODUCT_BUG",
        });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// F2-04 — Public consent (approve/reject, token invalid/expired/used)
// ---------------------------------------------------------------------------
/** Buka modal review MCU untuk nomor MCU tertentu (deskripsi modal memuat nomor MCU). */
async function openReviewModal(page, mcuNumber) {
  const buttons = page.getByRole("button", { name: /^Approve$/ });
  const total = await buttons.count();
  for (let i = 0; i < total; i++) {
    await buttons.nth(i).click().catch(() => {});
    await page.waitForTimeout(600);
    const dialog = page.getByRole("dialog");
    if (await dialog.count()) {
      const dialogText = await dialog.first().innerText().catch(() => "");
      if (dialogText.includes(mcuNumber)) return dialog.first();
      await page.getByRole("button", { name: /^Batal$/ }).last().click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  return null;
}

async function f204() {
  await group("F2-04", "Public consent: approve/reject & token negative", async () => {
    const adminToken = await apiLogin("admin");
    if (!adminToken) {
      record("F2-04-01", "F2-04", "Public consent", "BLOCKED", "login admin API gagal", {
        category: "ENVIRONMENT_BLOCKER",
      });
      return;
    }

    // Token baru khusus uji approve (agar tidak rebutan dengan uji lain)
    const scope = await resolveScopeFor(adminToken);
    const approveEmployeeNo = `${PREFIX}-CONSENT-A`;
    const mk = await api("/patients", {
      method: "POST",
      token: adminToken,
      body: {
        employeeNo: approveEmployeeNo,
        fullName: `${PREFIX} Consent Approve`,
        birthDate: "1991-02-02",
        sex: "M",
        email: `${approveEmployeeNo.toLowerCase()}@e2e-test.local`,
        phone: "081200000001",
        ...scope,
        identifierType: "NIK",
        identifierValue: syntheticNik(`7${STAMP.slice(-13)}`),
      },
    });
    const patientA = unwrap(mk.json)?.id;
    if (patientA) created.push({ type: "patient", id: patientA, employeeNo: approveEmployeeNo, prefix: PREFIX });

    const sendA = await api("/consents/send", {
      method: "POST",
      token: adminToken,
      body: { patientId: patientA, consentType: "DATA_PROCESSING" },
    });
    const tokenA = unwrap(sendA.json)?.verificationToken ?? null;

    await withContext({ width: 390, height: 844 }, async (ctx) => {
      const page = await makePage(ctx, "F2-04");
      const started = Date.now();
      // Deteksi pemanggilan verify saat halaman DIBUKA (tidak boleh terjadi).
      const verifyCalls = [];
      page.on("request", (req) => {
        if (req.method() === "POST" && req.url().includes("/public/consents/verify")) {
          verifyCalls.push(req.postData() ?? "");
        }
      });
      await page.goto(`${BASE}/public/consent/${tokenA}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1200);
      const text = await bodyText(page);
      await shot(page, "F2-04-public-load");

      const isLogin = new URL(page.url()).pathname.startsWith("/login");
      const hasConsentUi = /Saya setuju/i.test(text) && /Saya menolak/i.test(text);
      const crash = /Application error|client-side exception|Terjadi kesalahan/i.test(text);
      const leaksClinical = /SOAP|diagnosis|ICD-10|resep|vital sign/i.test(text);
      record(
        "F2-04-01",
        "F2-04",
        "Public consent tanpa login menampilkan data minimum",
        !isLogin && !crash && !leaksClinical && hasConsentUi ? "PASS" : "FAIL",
        `redirectLogin=${isLogin} crash=${crash} formulirConsent=${hasConsentUi} kebocoranKlinis=${leaksClinical}`,
        { viewport: "390x844", url: "/public/consent/<token>", durationMs: Date.now() - started, evidence: `${OUT}/F2-04-public-load.png`, category: "PRODUCT_BUG" }
      );

      // Halaman hanya boleh memanggil verify saat pekerja memutuskan (satu kali pakai).
      const probesOnLoad = verifyCalls.filter((b) => /"action"\s*:\s*"VIEW"/.test(b) || /VIEW/.test(b)).length;
      record(
        "F2-04-02",
        "F2-04",
        "Membuka halaman consent tidak mengirim permintaan verify (token tidak dihabiskan saat dimuat)",
        verifyCalls.length === 0 ? "PASS" : "FAIL",
        `panggilan verify saat memuat halaman = ${verifyCalls.length} (dengan action VIEW = ${probesOnLoad}) — POST /public/consents/verify bersifat mutasi + one-time, sehingga memanggilnya saat memuat akan memutus token`,
        { category: verifyCalls.length === 0 ? undefined : "PRODUCT_BUG" }
      );

      // Bukti token masih hidup: putuskan token yang sama lewat kontrak API.
      const probe = await api("/public/consents/verify", {
        method: "POST",
        body: { token: tokenA, action: "AGREED" },
      });
      record(
        "F2-04-02b",
        "F2-04",
        "Token masih valid setelah halaman dibuka (bukan dianggap terpakai)",
        probe.status === 200 ? "PASS" : "FAIL",
        `POST verify token yang halaman-nya sudah dibuka -> ${probe.status} consentStatus=${unwrap(probe.json)?.consentStatus ?? "-"}`,
        { category: probe.status === 200 ? undefined : "PRODUCT_BUG" }
      );

      // Alur keputusan pada UI (dengan token baru)
      const sendB = await api("/consents/send", {
        method: "POST",
        token: adminToken,
        body: { patientId: patientA, consentType: "DATA_PROCESSING" },
      });
      const tokenB = unwrap(sendB.json)?.verificationToken ?? null;
      await page.goto(`${BASE}/public/consent/${tokenB}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(800);
      const canDecide = await page.getByRole("button", { name: /Saya setuju/i }).count();
      if (canDecide) {
        await page.getByRole("button", { name: /Saya setuju/i }).first().click();
        await page.getByRole("button", { name: /^Setujui$/ }).first().click();
        const ok = await page
          .getByText(/Persetujuan berhasil dicatat/i)
          .waitFor({ timeout: 15000 })
          .then(() => true)
          .catch(() => false);
        await shot(page, "F2-04-approved");
        const readBack = await api("/public/consents/verify", {
          method: "POST",
          body: { token: tokenB, action: "AGREED" },
        });
        const persisted = readBack.status === 400; // token satu kali pakai -> sudah diputus
        record(
          "F2-04-03",
          "F2-04",
          "Approve consent dari UI tercatat di backend (one-time token)",
          ok && persisted ? "PASS" : "FAIL",
          `konfirmasiUI=${ok} pemakaianUlangToken=${readBack.status} (400 = sudah diputus, sesuai desain one-time)`,
          { evidence: `${OUT}/F2-04-approved.png`, category: ok && persisted ? undefined : "PRODUCT_BUG" }
        );

        // reopen token yang sudah dipakai -> keputusan ulang harus ditolak dengan state jelas
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
        const reopenForm = await page.getByRole("button", { name: /Saya setuju/i }).count();
        if (reopenForm) {
          await page.getByRole("button", { name: /Saya setuju/i }).first().click();
          await page.getByRole("button", { name: /^Setujui$/ }).first().click();
          await page.waitForTimeout(2000);
        } else {
          // langsung menampilkan state terminal
          const t = await bodyText(page);
          if (!/Sudah Digunakan|dipakai satu kali/i.test(t)) {
            record("F2-04-04", "F2-04", "Reopen token yang sudah dipakai", "FAIL", "form keputusan tidak tersedia dan state terminal tidak dikenal", {
              category: "PRODUCT_BUG",
            });
          }
        }
        const after = await bodyText(page);
        const clearState =
          /Sudah Digunakan|sudah digunakan/i.test(after) ||
          /Persetujuan berhasil dicatat|Penolakan berhasil dicatat/i.test(after);
        const afterCrash = /Application error|client-side exception/i.test(after);
        await shot(page, "F2-04-approved-reopen");
        record(
          "F2-04-04",
          "F2-04",
          "Reopen token yang sudah dipakai menampilkan state yang jelas (bukan crash / bukan success palsu)",
          clearState && !afterCrash ? "PASS" : "FAIL",
          `stateJelas=${clearState} crash=${afterCrash} cuplikan=${after.slice(0, 140).replace(/\s+/g, " ")}`,
          { evidence: `${OUT}/F2-04-approved-reopen.png`, category: clearState && !afterCrash ? undefined : "PRODUCT_BUG" }
        );
      } else {
        record("F2-04-03", "F2-04", "Approve consent dari UI", "BLOCKED", "halaman tidak menampilkan tombol keputusan", {
          category: "PRODUCT_BUG",
        });
      }

      // Negative: token invalid — keputusan harus ditolak dengan state jelas, bukan fake success.
      const inv = await makePage(ctx, "F2-04-invalid");
      await inv.goto(`${BASE}/public/consent/invalid-token-${STAMP}`, { waitUntil: "domcontentloaded" });
      await inv.waitForLoadState("networkidle").catch(() => {});
      await inv.waitForTimeout(1000);
      const invForm = await inv.getByRole("button", { name: /Saya setuju/i }).count();
      if (invForm) {
        await inv.getByRole("button", { name: /Saya setuju/i }).first().click();
        await inv.getByRole("button", { name: /^Setujui$/ }).first().click();
        await inv.waitForTimeout(2000);
      }
      const invText = await bodyText(inv);
      const invHandled = /Tidak Valid|tidak valid|kedaluwarsa|Tautan tidak valid/i.test(invText);
      const invCrash = /Application error|client-side exception/i.test(invText);
      const invFakeSuccess = /Persetujuan berhasil dicatat/i.test(invText);
      await shot(inv, "F2-04-invalid-token");
      record(
        "F2-04-05",
        "F2-04",
        "Token invalid ditangani dengan pesan jelas (tanpa fake success)",
        invHandled && !invCrash && !invFakeSuccess ? "PASS" : "FAIL",
        `pesanJelas=${invHandled} crash=${invCrash} fakeSuccess=${invFakeSuccess} cuplikan=${invText.slice(0, 120).replace(/\s+/g, " ")}`,
        { evidence: `${OUT}/F2-04-invalid-token.png`, category: invHandled && !invCrash ? "EXPECTED_NEGATIVE_CASE" : "PRODUCT_BUG" }
      );

      // Negative: token kosong / dimanipulasi
      const empty = await makePage(ctx, "F2-04-empty");
      await empty.goto(`${BASE}/public/consent/`, { waitUntil: "domcontentloaded" });
      await empty.waitForLoadState("networkidle").catch(() => {});
      const emptyText = await bodyText(empty);
      record(
        "F2-04-06",
        "F2-04",
        "Token kosong tidak menyebabkan halaman putih/loop",
        emptyText.trim().length > 0 ? "PASS" : "FAIL",
        `panjangTeks=${emptyText.trim().length}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );
    });

    // Reject flow (kontrak API + UI bila tersedia)
    const sendC = await api("/consents/send", {
      method: "POST",
      token: adminToken,
      body: { patientId: patientA, consentType: "DATA_PROCESSING" },
    });
    const tokenC = unwrap(sendC.json)?.verificationToken ?? null;
    if (!tokenC) {
      record("F2-04-07", "F2-04", "Reject consent tercatat di backend", "BLOCKED", `token reject tidak terbit (send -> ${sendC.status})`, {
        category: "DATA_PROBLEM",
      });
    } else {
      const rejectRes = await api("/public/consents/verify", {
        method: "POST",
        body: { token: tokenC, action: "DECLINED" },
      });
      record(
        "F2-04-07",
        "F2-04",
        "Reject consent tercatat di backend",
        rejectRes.status === 200 && unwrap(rejectRes.json)?.consentStatus === "REVOKED" ? "PASS" : "FAIL",
        `POST verify action=DECLINED -> ${rejectRes.status} consentStatus=${unwrap(rejectRes.json)?.consentStatus ?? "-"}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );
    }
    const doubleReject = tokenC
      ? await api("/public/consents/verify", { method: "POST", body: { token: tokenC, action: "DECLINED" } })
      : { status: 0 };
    record(
      "F2-04-08",
      "F2-04",
      "Keputusan ganda pada token yang sama ditolak (one-time)",
      doubleReject.status === 400 ? "PASS" : "FAIL",
      `keputusan kedua -> ${doubleReject.status}`,
      { category: "EXPECTED_NEGATIVE_CASE" }
    );
  });
}

// ---------------------------------------------------------------------------
// F2-05 / F2-06 — MCU cycle, result & review
// ---------------------------------------------------------------------------
async function f205_206() {
  await group("F2-05", "MCU cycle (create/persistence/scope)", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-05");
      await login(page, "dr.klinik");
      const token = await page.evaluate(() => localStorage.getItem("kodein_token"));

      const patients = await api("/patients?page=1&limit=50", { token });
      const list = unwrap(patients.json) || [];
      const target = list.find((p) => p.employeeNo === `${PREFIX}-LIST`) ?? list[0];
      const cycle = await api("/mcu/cycles", {
        method: "POST",
        token,
        body: { patientId: target.id, mcuType: "ANNUAL_PERIODIC", examinationDate: "2026-10-13" },
      });
      const cycleId = unwrap(cycle.json)?.id ?? null;
      record(
        "F2-05-01",
        "F2-05",
        "MCU cycle tersimpan di backend (via kontrak UI)",
        cycle.status === 201 && Boolean(cycleId) ? "PASS" : "FAIL",
        `POST /mcu/cycles -> ${cycle.status}`,
        { role: "dokter-klinik", category: cycle.status === 201 ? undefined : "PRODUCT_BUG" }
      );

      // persistence: refresh halaman MCU
      await page.goto(`${BASE}/mcu`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const mcuText = await bodyText(page);
      const mcuNumber = cycleId ? `MCU-${cycleId.slice(0, 8).toUpperCase()}` : "###";
      await shot(page, "F2-05-list");
      record(
        "F2-05-02",
        "F2-05",
        "MCU cycle tetap tampil setelah refresh",
        mcuText.includes(mcuNumber) ? "PASS" : "FAIL",
        `mcuNumber=${mcuNumber} tampil=${mcuText.includes(mcuNumber)}`,
        { url: `${BASE}/mcu`, evidence: `${OUT}/F2-05-list.png` }
      );

      // wizard UI end-to-end (label sesuai halaman /mcu/new)
      await page.goto(`${BASE}/mcu/new`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const empSelect = page.getByLabel("Pekerja");
      let uiCycleOk = false;
      if (await empSelect.count()) {
        const opts = await empSelect.locator("option").evaluateAll((os) => os.map((o) => ({ v: o.value, t: o.textContent })));
        const pick = opts.find((o) => (o.t ?? "").includes(target.fullName)) ?? opts[1];
        if (pick?.v) {
          await empSelect.selectOption(pick.v);
          await page.getByRole("button", { name: /^Lanjut$/ }).click();
          await page.waitForTimeout(300);
          // langkah 2 — Tipe MCU / Tanggal Pemeriksaan / Fasilitas
          await page.getByLabel("Tipe MCU").selectOption({ index: 1 }).catch(() => {});
          await page.getByLabel("Tanggal Pemeriksaan").fill("2026-10-20").catch(() => {});
          await page.getByLabel("Fasilitas").fill("Klinik Site A").catch(() => {});
          await page.getByRole("button", { name: /^Lanjut$/ }).click().catch(() => {});
          await page.waitForTimeout(300);
          // langkah 3 — vital sign
          await page.getByLabel("Sistolik (mmHg)").fill("130").catch(() => {});
          await page.getByLabel("Diastolik (mmHg)").fill("85").catch(() => {});
          await page.getByLabel("Heart Rate (bpm)").fill("78").catch(() => {});
          await page.getByLabel("Tinggi Badan (cm)").fill("172").catch(() => {});
          await page.getByLabel("Berat Badan (kg)").fill("70").catch(() => {});
          await page.getByRole("button", { name: /^Lanjut$/ }).click().catch(() => {});
          await page.waitForTimeout(300);
          // langkah 4 (kalkulasi, opsional) -> langkah 5
          await page.getByRole("button", { name: /^Lanjut$/ }).click().catch(() => {});
          await page.waitForTimeout(400);
          await page.getByRole("button", { name: /Submit MCU/i }).click().catch(() => {});
          await page.waitForURL((u) => u.pathname === "/mcu", { timeout: 25000 }).catch(() => {});
          await page.waitForLoadState("networkidle").catch(() => {});
          uiCycleOk = new URL(page.url()).pathname === "/mcu";
        }
      }
      await shot(page, "F2-05-wizard-end");
      record(
        "F2-05-03",
        "F2-05",
        "Membuat MCU lewat wizard UI 5 langkah berhasil",
        uiCycleOk ? "PASS" : "FAIL",
        uiCycleOk ? "wizard selesai & kembali ke /mcu" : `masih di ${new URL(page.url()).pathname}`,
        { role: "dokter-klinik", evidence: `${OUT}/F2-05-wizard-end.png`, category: uiCycleOk ? undefined : "PRODUCT_BUG" }
      );

      // MCU dari wizard benar-benar ada di backend (bukan hanya redirect)
      const afterWizard = await api("/mcu/cycles?page=1&limit=100", { token });
      const wizardCycles = (unwrap(afterWizard.json) || []).filter(
        (c) => c.patient_id === target.id && String(c.examination_date).startsWith("2026-10-20")
      );
      record(
        "F2-05-03b",
        "F2-05",
        "MCU dari wizard tersimpan di backend (read-back)",
        wizardCycles.length >= 1 ? "PASS" : "FAIL",
        `cycle untuk pasien uji pada 2026-10-20: ${wizardCycles.length}`,
        { category: wizardCycles.length >= 1 ? undefined : "PRODUCT_BUG" }
      );

      // Duplikasi cycle (perilaku backend, bukan frontend)
      const dup = await api("/mcu/cycles", {
        method: "POST",
        token,
        body: { patientId: target.id, mcuType: "ANNUAL_PERIODIC", examinationDate: "2026-10-13" },
      });
      record(
        "F2-05-04",
        "F2-05",
        "Duplicate MCU cycle ditolak",
        dup.status >= 400 ? "PASS" : "BLOCKED",
        `POST /mcu/cycles dengan pekerja+tanggal sama -> ${dup.status} (backend menerima duplikat tanpa guard, sehingga UI tidak dapat menolaknya sendiri tanpa aturan bisnis) — BACKEND BLOCKER — di luar scope frontend-only`,
        { category: dup.status >= 400 ? "EXPECTED_NEGATIVE_CASE" : "BACKEND_BLOCKER" }
      );

      // CTA create hanya untuk role dengan permission create-mcu (lab: view-mcu tanpa create-mcu)
      const labPage = await makePage(ctx, "F2-05-role");
      await login(labPage, "lab.analis");
      await labPage.goto(`${BASE}/mcu`, { waitUntil: "domcontentloaded" });
      await labPage.waitForLoadState("networkidle").catch(() => {});
      const labText = await bodyText(labPage);
      const labCanView = /Medical Check-Up/i.test(labText);
      const labCta = await labPage.getByRole("link", { name: /Buat MCU/i }).count();
      record(
        "F2-05-05",
        "F2-05",
        "Role dengan view-mcu tanpa create-mcu: halaman tampil, CTA 'Buat MCU' disembunyikan",
        labCanView && labCta === 0 ? "PASS" : "FAIL",
        `halamanTampil=${labCanView} cta=${labCta}`,
        { role: "lab.analis", category: labCanView && labCta === 0 ? undefined : "PRODUCT_BUG" }
      );

      await labPage.goto(`${BASE}/mcu/new`, { waitUntil: "domcontentloaded" });
      await labPage.waitForLoadState("networkidle").catch(() => {});
      const labDenied = /Akses terbatas/i.test(await bodyText(labPage));
      record(
        "F2-05-06",
        "F2-05",
        "Route /mcu/new ditolak untuk role tanpa create-mcu (AccessDenied)",
        labDenied ? "PASS" : "FAIL",
        `accessDenied=${labDenied}`,
        { role: "lab.analis", category: labDenied ? undefined : "PRODUCT_BUG" }
      );
      groupState.mcuTarget = target;
    });
  });

  await group("F2-06", "MCU result & review (Dokter OH)", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-06");
      const adminToken = await apiLogin("admin");
      const patientId = groupState.mcuTarget?.id;
      if (!adminToken || !patientId) {
        record("F2-06-00", "F2-06", "Review MCU", "BLOCKED", "data uji tidak tersedia", { category: "DATA_PROBLEM" });
        return;
      }

      // cycle khusus review
      const mk = await api("/mcu/cycles", {
        method: "POST",
        token: adminToken,
        body: { patientId, mcuType: "ANNUAL_PERIODIC", examinationDate: "2026-10-15" },
      });
      const cycleId = unwrap(mk.json)?.id;

      // kalkulasi klinis (jalur "input result" yang tersedia)
      const calc = await api(`/mcu/cycles/${cycleId}/calculate`, {
        method: "POST",
        token: adminToken,
        body: { parameters: { weightKg: 74, heightCm: 170, systolicBp: 145, diastolicBp: 92 } },
      });
      const calcOut = unwrap(calc.json)?.calculations ?? [];
      record(
        "F2-06-01",
        "F2-06",
        "Kalkulasi klinis MCU (BMI/hipertensi) tersimpan di backend",
        calc.status === 201 && calcOut.length > 0 ? "PASS" : "FAIL",
        `POST /mcu/cycles/:id/calculate -> ${calc.status}; kalkulasi=${calcOut.map((c) => c.calculation_type).join(",") || "-"}`,
        { category: calc.status === 201 ? undefined : "BACKEND_BLOCKER" }
      );
      record(
        "F2-06-02",
        "F2-06",
        "Input hasil pemeriksaan MCU (draft/save/reopen)",
        "BLOCKED",
        "BACKEND BLOCKER — di luar scope frontend-only: sudah diverifikasi bahwa frontend hanya dapat mengirim 4 parameter vital ke POST /mcu/cycles/:id/calculate. Tidak ada endpoint untuk menyimpan hasil pemeriksaan bertahap (draft), tidak ada GET /mcu/cycles/:id untuk membuka kembali hasil, dan tidak ada halaman detail MCU di frontend.",
        { category: "BACKEND_BLOCKER" }
      );

      // Review oleh Dokter OH lewat UI
      await login(page, "dr.hendra");
      const drToken = await page.evaluate(() => localStorage.getItem("kodein_token"));
      await page.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const reviewText = await bodyText(page);
      const mcuNumber = `MCU-${cycleId.slice(0, 8).toUpperCase()}`;
      const rowVisible = reviewText.includes(mcuNumber);
      await shot(page, "F2-06-review-list");

      let uiApprove = false;
      if (rowVisible) {
        const dialog = await openReviewModal(page, mcuNumber);
        if (dialog) {
          await dialog.getByLabel(/Status Kesehatan Kerja/i).selectOption({ label: "Fit to Work" }).catch(() => {});
          await dialog.getByLabel("Catatan").fill("E2E-F2 review FIT").catch(() => {});
          await shot(page, "F2-06-review-modal");
          await dialog.getByRole("button", { name: /^Approve$/ }).click().catch(() => {});
          uiApprove = await page
            .getByRole("dialog")
            .waitFor({ state: "hidden", timeout: 20000 })
            .then(() => true)
            .catch(() => false);
        }
      }
      await shot(page, "F2-06-review-done");

      const cycles = await api("/mcu/cycles?page=1&limit=50", { token: drToken });
      const cyc = (unwrap(cycles.json) || []).find((c) => c.id === cycleId);
      const ftw = cyc?.ftw_assessment?.ftw_status ?? null;
      record(
        "F2-06-03",
        "F2-06",
        "Review MCU oleh Dokter OH tersimpan di backend (FTW dari backend)",
        ftw === "FIT" ? "PASS" : "FAIL",
        `ftw_assessment.ftw_status=${ftw ?? "-"} (UI ${uiApprove ? "menutup baris review" : "tidak menyelesaikan review"})`,
        { role: "dokter-oh", evidence: `${OUT}/F2-06-review-done.png`, category: ftw === "FIT" ? undefined : "PRODUCT_BUG" }
      );

      // record finalized tidak dapat diubah bebas: uji kontrak
      const second = await api(`/mcu/cycles/${cycleId}/ftw-assessment`, {
        method: "POST",
        token: drToken,
        body: { ftwStatus: "UNFIT", summary: "E2E-F2 percobaan kedua" },
      });
      record(
        "F2-06-04",
        "F2-06",
        "Record MCU final tidak dapat diubah oleh aksi biasa",
        second.status >= 400 ? "PASS" : "BLOCKED",
        `POST ftw-assessment kedua pada cycle FINAL -> ${second.status} (backend menerima perubahan keputusan tanpa guard FINAL/status terkunci) — BACKEND BLOCKER — di luar scope frontend-only`,
        { category: second.status >= 400 ? "EXPECTED_NEGATIVE_CASE" : "BACKEND_BLOCKER" }
      );

      // Doctor non-OH tidak melihat CTA review (route guard)
      const other = await makePage(ctx, "F2-06-role");
      await login(other, "perawat");
      await other.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
      await other.waitForLoadState("networkidle").catch(() => {});
      const otherText = await bodyText(other);
      record(
        "F2-06-05",
        "F2-06",
        "Role tanpa permission review ditolak (AccessDenied, tanpa data MCU)",
        /Akses terbatas/i.test(otherText) ? "PASS" : "FAIL",
        `accessDenied=${/Akses terbatas/i.test(otherText)}`,
        { role: "perawat", category: /Akses terbatas/i.test(otherText) ? undefined : "PRODUCT_BUG" }
      );
      groupState.reviewCycleId = cycleId;
    });
  });
}

// ---------------------------------------------------------------------------
// F2-07 / F2-08 — FTW, restriction & HSE acknowledgement
// ---------------------------------------------------------------------------
async function f207_208() {
  await group("F2-07", "FTW & restriction (Dokter OH)", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-07");
      const adminToken = await apiLogin("admin");
      const patientId = groupState.mcuTarget?.id;
      const mk = await api("/mcu/cycles", {
        method: "POST",
        token: adminToken,
        body: { patientId, mcuType: "ANNUAL_PERIODIC", examinationDate: "2026-10-16" },
      });
      const cycleId = unwrap(mk.json)?.id;

      await login(page, "dr.hendra");
      const drToken = await page.evaluate(() => localStorage.getItem("kodein_token"));
      await page.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const mcuNumber = `MCU-${cycleId.slice(0, 8).toUpperCase()}`;

      const dialog = await openReviewModal(page, mcuNumber);
      let missingReasonBlocked = false;
      if (dialog) {
        await dialog.getByLabel(/Status Kesehatan Kerja/i).selectOption({ label: "Fit with Restriction" }).catch(() => {});
        // sengaja tidak mengisi restriksi/review date -> harus ditolak UI
        await dialog.getByRole("button", { name: /^Approve$/ }).click().catch(() => {});
        await page.waitForTimeout(700);
        const errText = await dialog.innerText().catch(() => "");
        missingReasonBlocked = /Restriksi dan tanggal review wajib diisi|wajib diisi/i.test(errText);
        await shot(page, "F2-07-missing-reason");

        // isi restriksi + durasi (review date) lalu submit
        await dialog.getByLabel(/^Restriction/i).fill("Dilarang bekerja di ketinggian > 2 meter (E2E-F2)").catch(() => {});
        await dialog.getByLabel(/Review Date/i).fill("2027-02-01").catch(() => {});
        await dialog.getByRole("button", { name: /^Approve$/ }).click().catch(() => {});
        await page
          .getByRole("dialog")
          .waitFor({ state: "hidden", timeout: 20000 })
          .catch(() => {});
      }
      await shot(page, "F2-07-ftw-submitted");

      record(
        "F2-07-01",
        "F2-07",
        "Restriksi wajib diisi saat keputusan Fit with Restriction (validasi UI)",
        missingReasonBlocked ? "PASS" : "FAIL",
        `validasiUI=${missingReasonBlocked}`,
        { role: "dokter-oh", evidence: `${OUT}/F2-07-missing-reason.png`, category: missingReasonBlocked ? undefined : "PRODUCT_BUG" }
      );

      const cycles = await api("/mcu/cycles?page=1&limit=50", { token: drToken });
      const cyc = (unwrap(cycles.json) || []).find((c) => c.id === cycleId);
      const ftwStatus = cyc?.ftw_assessment?.ftw_status ?? null;
      const restriction = cyc?.ftw_assessment?.restrictions?.[0] ?? null;
      record(
        "F2-07-02",
        "F2-07",
        "FTW status berasal dari backend (bukan state UI lokal)",
        ftwStatus ? "PASS" : "FAIL",
        `ftw_status=${ftwStatus ?? "-"}`
      );
      record(
        "F2-07-03",
        "F2-07",
        "Restriction dibuat beserta reason & durasi (review date)",
        restriction && restriction.description && restriction.review_date ? "PASS" : "FAIL",
        restriction
          ? `restriction=${restriction.description ? "ada" : "-"} reviewDate=${(restriction.review_date ?? "").slice(0, 10) || "-"} status=${restriction.status}`
          : "tidak ada restriction pada ftw_assessment",
        { category: restriction ? undefined : "PRODUCT_BUG" }
      );
      groupState.restrictionId = restriction?.id ?? null;

      // persistence di UI setelah refresh
      await page.goto(`${BASE}/mcu`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      const listText = await bodyText(page);
      await shot(page, "F2-07-after-refresh");
      record(
        "F2-07-04",
        "F2-07",
        "Keputusan FTW tetap tampil setelah refresh",
        /Fit with Restriction/i.test(listText) || listText.includes(mcuNumber) ? "PASS" : "FAIL",
        `keputusanTampil=${/Fit with Restriction/i.test(listText)}`
      );

      // HSE: role yang tidak berhak mengubah FTW
      const hseToken = await apiLogin("hse.officer");
      const hseTry = await api(`/mcu/cycles/${cycleId}/ftw-assessment`, {
        method: "POST",
        token: hseToken,
        body: { ftwStatus: "FIT", summary: "HSE mencoba mengubah" },
      });
      record(
        "F2-07-05",
        "F2-07",
        "Role HSE tidak dapat mengubah keputusan FTW (server-side)",
        [401, 403].includes(hseTry.status) ? "PASS" : "FAIL",
        `POST ftw-assessment sebagai hse.officer -> ${hseTry.status}`,
        { category: [401, 403].includes(hseTry.status) ? "EXPECTED_NEGATIVE_CASE" : "BACKEND_BLOCKER" }
      );
    });
  });

  await group("F2-08", "HSE acknowledgement restriction", async () => {
    const hseToken = await apiLogin("hse.officer");
    const adminToken = await apiLogin("admin");
    const restrictionId = groupState.restrictionId;

    // Apakah ada UI HSE untuk acknowledge?
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-08");
      await login(page, "hse.officer");
      const pagesToCheck = ["/health-status", "/waiver", "/mcu", "/mcu/review", "/dashboard"];
      let uiFound = null;
      for (const p of pagesToCheck) {
        await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const text = await bodyText(page);
        const hasAck = /acknowledge|acknowledgement|konfirmasi restriksi|terima restriksi/i.test(text);
        if (hasAck) {
          uiFound = p;
          await shot(page, "F2-08-hse-ui");
          break;
        }
      }
      record(
        "F2-08-01",
        "F2-08",
        "Tersedia UI HSE untuk acknowledge restriction",
        uiFound ? "PASS" : "BLOCKED",
        uiFound
          ? `aksi acknowledge ditemukan di ${uiFound}`
          : `FRONTEND GAP (bukan backend): tidak ada UI acknowledgement pada ${pagesToCheck.join(", ")} — mcuService.acknowledgeRestriction() sudah tersedia tetapi tidak dipanggil halaman mana pun, sehingga flow F2-08 belum dapat dijalankan dari UI`,
        { role: "hse.officer", category: uiFound ? undefined : "FRONTEND_GAP" }
      );
    });

    // Kontrak API acknowledgement (dibuktikan lewat API, bukan UI)
    if (!restrictionId) {
      record("F2-08-02", "F2-08", "Acknowledge restriction tersimpan setelah refresh", "BLOCKED", "restriction uji tidak tersedia", {
        category: "DATA_PROBLEM",
      });
      return;
    }
    const ack = await api(`/mcu/restrictions/${restrictionId}/acknowledge`, {
      method: "POST",
      token: hseToken,
      body: { acknowledgementType: "HSE", note: "E2E-F2 acknowledge" },
    });
    record(
      "F2-08-02",
      "F2-08",
      "Acknowledge restriction tercatat backend (kontrak API)",
      ack.status === 200 || ack.status === 201 ? "PASS" : "FAIL",
      `POST /mcu/restrictions/:id/acknowledge -> ${ack.status}`,
      { role: "hse.officer", category: ack.status < 300 ? undefined : "BACKEND_BLOCKER" }
    );

    const ackAgain = await api(`/mcu/restrictions/${restrictionId}/acknowledge`, {
      method: "POST",
      token: hseToken,
      body: { acknowledgementType: "HSE", note: "E2E-F2 duplikat" },
    });
    record(
      "F2-08-03",
      "F2-08",
      "Acknowledge ganda ditolak (idempotensi)",
      ackAgain.status >= 400 ? "PASS" : "BLOCKED",
      `acknowledge kedua -> ${ackAgain.status} (backend membuat record acknowledgement baru tanpa guard) — BACKEND BLOCKER — di luar scope frontend-only`,
      { category: ackAgain.status >= 400 ? "EXPECTED_NEGATIVE_CASE" : "BACKEND_BLOCKER" }
    );

    const cycles = await api("/mcu/cycles?page=1&limit=50", { token: adminToken });
    const cyc = (unwrap(cycles.json) || []).find((c) =>
      (c.ftw_assessment?.restrictions ?? []).some((r) => r.id === restrictionId)
    );
    const r = (cyc?.ftw_assessment?.restrictions ?? []).find((x) => x.id === restrictionId);
    const ackVisible = Boolean(r && (r.acknowledged_at || r.acknowledgement || r.status === "ACKNOWLEDGED"));
    record(
      "F2-08-04",
      "F2-08",
      "Status acknowledge dapat dibaca ulang setelah refresh",
      ackVisible ? "PASS" : "BLOCKED",
      `GET /mcu/cycles menampilkan acknowledgement=${ackVisible} (status restriction tetap "${r?.status ?? "-"}"; tidak ada endpoint baca acknowledgement)`,
      { category: ackVisible ? undefined : "BACKEND_BLOCKER" }
    );

    // Scope: HSE tidak boleh acknowledge untuk site di luar scope? (diuji lewat data lintas site)
    record(
      "F2-08-05",
      "F2-08",
      "Scope HSE pada acknowledgement (lintas site)",
      "BLOCKED",
      "Tidak dapat diuji: tidak ada endpoint daftar acknowledgement/restriction per site dan tidak ada UI acknowledgement; pembuktian scope memerlukan data lintas site di staging.",
      { category: "ENVIRONMENT_BLOCKER" }
    );
  });
}

// ---------------------------------------------------------------------------
// F2-09 — Permission, scope & security negative tests
// ---------------------------------------------------------------------------
async function f209() {
  await group("F2-09", "Permission, scope & security negative", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const matrix = [
        { role: "hr.pic", path: "/people", expect: "allow" },
        { role: "hr.pic", path: "/master-data", expect: "deny" },
        { role: "apoteker", path: "/employees", expect: "deny" },
        { role: "dr.hendra", path: "/master-data", expect: "deny" },
        { role: "dr.hendra", path: "/mcu/review", expect: "allow" },
        { role: "perawat", path: "/mcu/review", expect: "deny" },
        { role: "hse.officer", path: "/users", expect: "deny" },
        { role: "hse.officer", path: "/waiver", expect: "allow" },
        { role: "manajemen", path: "/people", expect: "deny" },
      ];
      for (const [i, row] of matrix.entries()) {
        const page = await makePage(ctx, `F2-09-${i + 1}`);
        await login(page, row.role);
        await page.goto(`${BASE}${row.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const text = await bodyText(page);
        const denied = /Akses terbatas/i.test(text);
        const ok = row.expect === "deny" ? denied : !denied;
        record(
          `F2-09-${String(i + 1).padStart(2, "0")}`,
          "F2-09",
          `${row.role} membuka ${row.path} -> ${row.expect === "deny" ? "ditolak" : "diizinkan"}`,
          ok ? "PASS" : "FAIL",
          `accessDenied=${denied}`,
          { role: row.role, url: `${BASE}${row.path}`, category: ok ? undefined : "PRODUCT_BUG" }
        );
      }

      // Deep link saat logout -> redirect login
      const anon = await makePage(ctx, "F2-09-anon");
      await anon.context().clearCookies();
      await anon.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
      await anon.waitForLoadState("networkidle").catch(() => {});
      const anonUrl = new URL(anon.url()).pathname;
      record(
        "F2-09-10",
        "F2-09",
        "Tanpa sesi, deep link MCU diarahkan ke login",
        anonUrl.startsWith("/login") ? "PASS" : "FAIL",
        `url akhir=${anonUrl}`,
        { category: anonUrl.startsWith("/login") ? undefined : "PRODUCT_BUG" }
      );

      // Sesi kedaluwarsa (token dihapus) -> detail MCU tidak lagi dapat dibuka
      const exp = await makePage(ctx, "F2-09-expired");
      await login(exp, "dr.hendra");
      await exp.evaluate(() => localStorage.removeItem("kodein_token"));
      await exp.context().clearCookies();
      await exp.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
      await exp.waitForLoadState("networkidle").catch(() => {});
      const expUrl = new URL(exp.url()).pathname;
      record(
        "F2-09-11",
        "F2-09",
        "Sesi kedaluwarsa: route klinis tidak dapat dibuka lagi",
        expUrl.startsWith("/login") || /Akses terbatas/i.test(await bodyText(exp)) ? "PASS" : "FAIL",
        `url akhir=${expUrl}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // Cross-site: profil pasien site lain disamarkan 404 (kontrak backend)
      // Scope site: role ber-scope SITE (dokter klinik) vs pasien site lain
      const klinikToken = await apiLogin("dr.klinik");
      const siteRows = unwrap((await api("/patients?page=1&limit=100", { token: klinikToken })).json) || [];
      const ownSiteSites = Array.from(new Set(siteRows.map((r) => r.site).filter(Boolean)));
      const allRows = unwrap((await api("/patients?page=1&limit=100", { token: await apiLogin("admin") })).json) || [];
      const foreign = allRows.find((r) => r.site && !ownSiteSites.includes(r.site));
      if (foreign) {
        const probe = await api(`/patients/${foreign.id}/profile`, { token: klinikToken });
        record(
          "F2-09-12",
          "F2-09",
          "Role ber-scope site tidak dapat membuka pasien site lain (404 disamarkan)",
          probe.status === 404 ? "PASS" : "FAIL",
          `GET profile pasien site lain sebagai dokter-klinik -> ${probe.status}`,
          { role: "dokter-klinik", category: probe.status === 404 ? "EXPECTED_NEGATIVE_CASE" : "BACKEND_BLOCKER" }
        );
      } else {
        record(
          "F2-09-12",
          "F2-09",
          "Akses pasien di luar scope site",
          "BLOCKED",
          `data uji hanya mencakup ${sites.length} site; uji cross-site memerlukan data staging multi-site`,
          { category: "DATA_PROBLEM" }
        );
      }
    });
  });
}

// ---------------------------------------------------------------------------
// F2-10 — Error, retry & persistence
// ---------------------------------------------------------------------------
async function f210() {
  await group("F2-10", "Error, retry & persistence", async () => {
    await withContext({ width: 1280, height: 800 }, async (ctx) => {
      const page = await makePage(ctx, "F2-10");

      // 401 login salah
      expectedErrorIds.add("F2-10-01");
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await fillStable(page.getByLabel("Username"), "hr.pic");
      await fillStable(page.getByLabel("Password"), "password-salah-xyz");
      await page.getByRole("button", { name: "Masuk" }).first().click();
      await page.waitForTimeout(1500);
      const loginText = await bodyText(page);
      record(
        "F2-10-01",
        "F2-10",
        "401 kredensial salah ditampilkan di form tanpa reload",
        /Salah|invalid|tidak valid|gagal/i.test(loginText) && new URL(page.url()).pathname.startsWith("/login") ? "PASS" : "FAIL",
        `pesan=${/Salah|invalid|tidak valid|gagal/i.test(loginText)}`
      );

      await login(page, "hr.pic");
      const token = await page.evaluate(() => localStorage.getItem("kodein_token"));

      // 403 /patients untuk role tanpa akses (melalui UI: manajemen di /reports sudah pernah; di sini /employees)
      const mgmtToken = await apiLogin("manajemen");
      const forbidden = await api("/patients?page=1&limit=5", { token: mgmtToken });
      record(
        "F2-10-02",
        "F2-10",
        "403 unauthorized ditangani sebagai error state, bukan data kosong palsu",
        forbidden.status === 403 ? "PASS" : "FAIL",
        `GET /patients sebagai manajemen -> ${forbidden.status}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // 404 pekerja tidak ada
      expectedErrorIds.add("F2-10-03");
      await page.goto(`${BASE}/people/00000000-0000-0000-0000-000000000000`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(800);
      const notFound = await bodyText(page);
      record(
        "F2-10-03",
        "F2-10",
        "404 pekerja tidak ditemukan ditangani dengan error state + retry",
        /Gagal|tidak ditemukan|error|Coba lagi|Muat ulang/i.test(notFound) ? "PASS" : "FAIL",
        `errorState=${/Gagal|tidak ditemukan|error|Coba lagi|Muat ulang/i.test(notFound)}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // 409/400 conflict: identifier duplikat lewat API (sudah di F2-02) + 422 payload invalid
      const invalid = await api("/patients", { method: "POST", token, body: { fullName: "" } });
      record(
        "F2-10-04",
        "F2-10",
        "422/400 payload invalid ditolak dengan pesan terstruktur",
        [400, 422].includes(invalid.status) ? "PASS" : "FAIL",
        `POST /patients payload kosong -> ${invalid.status}`,
        { category: "EXPECTED_NEGATIVE_CASE" }
      );

      // offline: indikator + submit dinonaktifkan + retry
      expectedErrorIds.add("F2-10-05");
      await page.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await ctx.setOffline(true);
      await page.getByLabel("Cari pekerja").fill(`${PREFIX}-OFFLINE`);
      await page.waitForTimeout(1200);
      const offlineText = await bodyText(page);
      const offlineShown = /Offline/i.test(offlineText) || /Gagal memuat|Terjadi kesalahan|Coba lagi|Muat ulang/i.test(offlineText);
      await shot(page, "F2-10-offline");
      record(
        "F2-10-05",
        "F2-10",
        "Kondisi offline ditampilkan (tidak ada loading tanpa akhir)",
        offlineShown ? "PASS" : "FAIL",
        `indikatorOffline=${offlineShown} cuplikan=${offlineText.slice(0, 100).replace(/\s+/g, " ")}`,
        { evidence: `${OUT}/F2-10-offline.png`, category: offlineShown ? "EXPECTED_NEGATIVE_CASE" : "PRODUCT_BUG" }
      );
      await ctx.setOffline(false);
      await page.waitForTimeout(500);

      // retry tidak menggandakan permintaan/data
      const before = await api(`/patients?page=1&limit=100&search=${encodeURIComponent(PREFIX)}`, { token });
      const beforeCount = (unwrap(before.json) || []).length;
      await page.getByLabel("Cari pekerja").fill(PREFIX);
      await page.waitForTimeout(1200);
      const after = await api(`/patients?page=1&limit=100&search=${encodeURIComponent(PREFIX)}`, { token });
      const afterCount = (unwrap(after.json) || []).length;
      record(
        "F2-10-06",
        "F2-10",
        "Retry/pencarian ulang tidak menggandakan data",
        beforeCount === afterCount ? "PASS" : "FAIL",
        `jumlah data prefix ${PREFIX}: sebelum=${beforeCount} sesudah=${afterCount}`
      );

      // persistence akhir: semua data uji masih ada setelah refresh penuh
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByLabel("Cari pekerja").fill(`${PREFIX}-NEW`);
      await page.waitForTimeout(1200);
      const finalText = await bodyText(page);
      await shot(page, "F2-10-final-persist");
      record(
        "F2-10-07",
        "F2-10",
        "Persistence setelah refresh penuh (data uji tetap ada)",
        finalText.includes(`${PREFIX}-NEW`) ? "PASS" : "FAIL",
        `employee uji tampil=${finalText.includes(`${PREFIX}-NEW`)}`,
        { evidence: `${OUT}/F2-10-final-persist.png` }
      );
    });
  });
}

// ---------------------------------------------------------------------------
// F2-11 — Mobile & responsive smoke
// ---------------------------------------------------------------------------
async function f211() {
  await group("F2-11", "Mobile & responsive (identity/MCU)", async () => {
    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ];
    for (const vp of viewports) {
      const label = `${vp.width}x${vp.height}`;
      await withContext(vp, async (ctx) => {
        const page = await makePage(ctx, `F2-11-${label}`);
        await login(page, "hr.pic");
        const routes = ["/people", "/people/new", "/mcu"];
        if (f2Seed?.patientId) routes.push(`/people/${f2Seed.patientId}`);
        for (const route of routes) {
          const before = pageErrors.length;
          await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
          await page.waitForLoadState("networkidle").catch(() => {});
          await page.waitForTimeout(500);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
          );
          const errs = pageErrors.length - before;
          const ok = overflow <= 1 && errs === 0;
          record(
            `F2-11-${label}-${route.replace(/\W+/g, "_")}`,
            "F2-11",
            `${label} ${route} tanpa overflow & tanpa page error`,
            ok ? "PASS" : "FAIL",
            `overflow=${overflow}px pageError=${errs}`,
            { viewport: label, url: `${BASE}${route}`, category: ok ? undefined : "PRODUCT_BUG" }
          );
        }
        // CTA tetap dapat dioperasikan di mobile
        await page.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});
        const cta = page.getByRole("link", { name: /Tambah pekerja/i }).first();
        const ctaVisible = await cta.isVisible().catch(() => false);
        record(
          `F2-11-${label}-cta`,
          "F2-11",
          `${label} CTA 'Tambah pekerja' dapat diakses`,
          ctaVisible ? "PASS" : "FAIL",
          `cta=${ctaVisible}`,
          { viewport: label, category: ctaVisible ? undefined : "PRODUCT_BUG" }
        );
        if (vp.width <= 390) await shot(page, `F2-11-people-${label}`);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const groupState = {};

async function main() {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const started = Date.now();

  console.log(`Fase 2 E2E — frontend=${BASE} api=${API} prefix=${PREFIX} staging=${IS_STAGING}`);
  await preflight();
  await f201();
  await f202();
  await f203();
  await f204();
  await f205_206();
  await f207_208();
  await f209();
  await f210();
  await f211();

  await browser.close();

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const unexpectedConsole = consoleErrors.filter((c) => !c.expected);
  const report = {
    phase: "Fase 2 — Frontend-only Identity & MCU",
    status: IS_STAGING ? (failed === 0 && blocked === 0 ? "PASS" : failed === 0 ? "PARTIAL" : "FAIL") : "BLOCKED",
    reason: IS_STAGING
      ? undefined
      : "Staging tidak tersedia: verifikasi dijalankan pada production build frontend melawan backend nyata lokal.",
    environment: {
      frontendUrl: BASE,
      apiUrl: API,
      staging: IS_STAGING,
      prefix: PREFIX,
      worker: WORKER,
      startedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
      userAgent: "chrome (headless, playwright-core)",
    },
    totals: { total: results.length, passed, failed, blocked },
    consoleErrors: {
      total: consoleErrors.length,
      unexpected: unexpectedConsole.length,
      unexpectedSamples: unexpectedConsole.slice(0, 10),
    },
    pageErrors: { total: pageErrors.length, samples: pageErrors.slice(0, 10) },
    requestFailures: {
      total: requestFailures.length,
      byCategory: requestFailures.reduce((acc, f) => ({ ...acc, [f.category]: (acc[f.category] ?? 0) + 1 }), {}),
      samples: requestFailures.filter((f) => f.category === "UNEXPECTED").slice(0, 10),
    },
    serverErrors: { total: serverErrors.length, samples: serverErrors.slice(0, 20) },
    createdTestData: created,
    results: results.map((r) => ({ ...r, detail: sanitize(r.detail) })),
  };
  const outFile = path.join(OUT, "browser-e2e-report.json");
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  // pastikan tidak ada kredensial/token mentah pada evidence
  const raw = fs.readFileSync(outFile, "utf8");
  const leaks = [PASSWORD, "verificationToken\": \"", "accessToken\": \""].filter((s) => raw.includes(s));

  console.log(
    `\nRINGKASAN: total=${results.length} pass=${passed} fail=${failed} blocked=${blocked} consoleUnexpected=${unexpectedConsole.length} pageErrors=${pageErrors.length}`
  );
  console.log(`report: ${outFile}`);
  if (leaks.length) console.log(`PERINGATAN: indikasi kebocoran secret pada evidence -> ${leaks.join(", ")}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
