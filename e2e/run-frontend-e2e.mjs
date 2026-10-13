#!/usr/bin/env node
/**
 * E2E frontend-only runner (F1-A / F1-B).
 *
 * Mode:
 *   ui-only   (default) — TANPA backend & TANPA kredensial. Hanya butuh production
 *                         build frontend (`next build && next start`). Menguji
 *                         route publik, redirect tanpa sesi, error shell,
 *                         mobile/responsive, dan memastikan build produksi tidak
 *                         memuat akun demo.
 *   contract            — TANPA backend. Menguji UI HSE acknowledgement memakai
 *                         **mock network di browser** (bukan backend baru) untuk
 *                         membuktikan permission visibility, confirmation,
 *                         submitting, success-setelah-response, error + retry,
 *                         anti double-submit, dan keterbatasan persistence.
 *                         Hasil diberi label `frontend-contract-test`.
 *   business            — MEMBUTUHKAN backend yang sudah ada (E2E_API_URL).
 *                         Mendelegasikan ke suite bisnis yang sudah ada
 *                         (`e2e/fase2-identity-mcu-staging.mjs`). Tidak membuat
 *                         backend baru; bila backend tidak tersedia → exit 1
 *                         dengan status BLOCKED (tidak ada fake green).
 *
 * Menjalankan:
 *   npx next build && npx next start -p 3001
 *   E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend
 *   E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend -- --mode=contract
 *   E2E_BASE_URL=http://localhost:3001 E2E_API_URL=http://localhost:3100/api/v1 \
 *     npm run test:e2e:frontend -- --mode=business
 *
 * Env:
 *   E2E_BASE_URL        default http://localhost:3001
 *   E2E_API_URL         hanya untuk mode business
 *   E2E_MODE            ui-only | contract | business | all
 *   E2E_OUT_DIR         default test-artifacts/frontend-e2e
 *   E2E_CHROME_PATH     executable Chrome alternatif (CI tanpa channel chrome)
 *   E2E_EXPECT_DEMO_ACCOUNTS=1  bila environment memang demo (default: tidak ada)
 */
import { spawn } from "node:child_process";
import path from "node:path";
import {
  createReporter,
  ensureDir,
  isStagingUrl,
  launchBrowser,
  loadPlaywright,
} from "./lib/browser.mjs";
import { runContractConsent, runContractPeople } from "./lib/contract-suites.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const API_URL = (process.env.E2E_API_URL ?? "").replace(/\/+$/, "");
const OUT = process.env.E2E_OUT_DIR ?? path.join("test-artifacts", "frontend-e2e");
const EXPECT_DEMO_ACCOUNTS = process.env.E2E_EXPECT_DEMO_ACCOUNTS === "1";

const argMode = (process.argv.find((a) => a.startsWith("--mode=")) ?? "").split("=")[1];
const MODE = (process.env.E2E_MODE ?? argMode ?? "ui-only").toLowerCase();

const VIEWPORTS = [
  [360, 800],
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];

const reporter = createReporter({
  outDir: OUT,
  meta: {
    suite: "frontend-e2e",
    mode: MODE,
    baseUrl: BASE,
    apiUrl: API_URL || null,
    isStaging: isStagingUrl(BASE),
    reportName: `browser-e2e-${MODE === "all" ? "ui-only-contract" : MODE}-report.json`,
    note: "ui-only/contract tidak membutuhkan backend baru; business memakai backend yang sudah ada.",
  },
});

function record(...args) {
  return reporter.record(...args);
}

async function newPage(browser, viewport, label) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    locale: "id-ID",
  });
  const page = await context.newPage();
  reporter.trackPage(page, label);
  return { context, page };
}

async function bodyText(page) {
  return ((await page.locator("body").innerText().catch(() => "")) || "").trim();
}

/** Overflow horizontal diukur pada elemen akar + body. */
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const clientWidth = doc.clientWidth;
    return { scrollWidth, clientWidth, overflow: scrollWidth - clientWidth };
  });
}

async function waitIdle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
}

// ---------------------------------------------------------------------------
// MODE ui-only — TANPA backend, TANPA kredensial
// ---------------------------------------------------------------------------
async function runUiOnly(browser) {
  // --- F1B-1: login shell di semua viewport ---
  for (const [w, h] of VIEWPORTS) {
    const label = `ui-login-${w}x${h}`;
    const { context, page } = await newPage(browser, [w, h], label);
    try {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);

      const username = page.getByLabel("Username");
      const password = page.getByLabel("Password");
      const submit = page.getByRole("button", { name: "Masuk" }).first();
      const formOk =
        (await username.isVisible().catch(() => false)) &&
        (await password.isVisible().catch(() => false)) &&
        (await submit.isVisible().catch(() => false));
      record(
        `F1B-01-${w}`,
        "F1-B Mobile shell",
        `/login usable @${w}x${h}`,
        formOk ? "PASS" : "FAIL",
        `username=${await username.isVisible().catch(() => false)} password=${await password
          .isVisible()
          .catch(() => false)} submit=${await submit.isVisible().catch(() => false)}`
      );

      const overflow = await horizontalOverflow(page);
      record(
        `F1B-02-${w}`,
        "F1-B Mobile shell",
        `tidak ada horizontal overflow @${w}x${h}`,
        overflow.overflow <= 1 ? "PASS" : "FAIL",
        `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`
      );

      // Aksi utama tidak tertutup viewport (mis. bottom navigation)
      const box = await submit.boundingBox();
      const insideViewport = Boolean(box && box.y + box.height <= h + 1 && box.x >= 0 && box.x + box.width <= w + 1);
      record(
        `F1B-03-${w}`,
        "F1-B Mobile shell",
        `tombol Masuk di dalam viewport @${w}x${h}`,
        insideViewport ? "PASS" : "FAIL",
        box ? `y=${Math.round(box.y)} h=${Math.round(box.height)}` : "boundingBox tidak tersedia"
      );

      await reporter.shot(page, `login-${w}x${h}`);
    } finally {
      await context.close();
    }
  }

  // --- F1B-4: environment label + demo credential ABSENT ---
  {
    const { context, page } = await newPage(browser, [1280, 800], "ui-env-label");
    try {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const label = page.locator('[data-testid="environment-label"]');
      const labelText = (await label.first().innerText().catch(() => "")) || "";
      record(
        "F1B-04",
        "F1-C Environment",
        "label environment tampil pada shell publik",
        ["Production", "Staging", "Local Development", "Tidak diketahui"].some((v) =>
          labelText.includes(v)
        )
          ? "PASS"
          : "FAIL",
        `label="${labelText.trim()}"`
      );

      const demoCount = await page.locator('[data-testid="demo-accounts"]').count();
      const html = await page.content();
      const hasSeedPassword = /KlinikLNG2026|NEXT_PUBLIC_DEMO_PASSWORD/.test(html);
      record(
        "F1B-05",
        "F1-C Environment",
        "build produksi tanpa flag demo: akun demo & kredensial tidak tampil",
        !EXPECT_DEMO_ACCOUNTS && demoCount === 0 && !hasSeedPassword ? "PASS" : "FAIL",
        EXPECT_DEMO_ACCOUNTS
          ? "dilewati: E2E_EXPECT_DEMO_ACCOUNTS=1 (environment demo)"
          : `demoAccounts=${demoCount} seedPasswordInHtml=${hasSeedPassword}`
      );
    } finally {
      await context.close();
    }
  }

  // --- F1B-5: error message terlihat (validasi form, tanpa backend) ---
  {
    const { context, page } = await newPage(browser, [390, 844], "ui-login-error");
    try {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await page.getByRole("button", { name: "Masuk" }).first().click();
      await page.waitForTimeout(300);
      const text = await bodyText(page);
      record(
        "F1B-06",
        "F1-B Mobile shell",
        "validasi kosong menampilkan pesan error yang terlihat",
        /wajib diisi/i.test(text) ? "PASS" : "FAIL",
        `snippet="${text.slice(0, 80).replace(/\s+/g, " ")}"`
      );
      await reporter.shot(page, "login-error-390x844");
    } finally {
      await context.close();
    }
  }

  // --- F1B-6: route publik tanpa sesi + TIDAK memutasi token saat load ---
  for (const [w, h] of [
    [390, 844],
    [1280, 800],
  ]) {
    const label = `ui-public-${w}x${h}`;
    const { context, page } = await newPage(browser, [w, h], label);
    try {
      const before = reporter.requests.length;
      await page.goto(`${BASE}/public/consent/token-tidak-dikenal-e2e`, {
        waitUntil: "domcontentloaded",
      });
      await waitIdle(page);
      const text = await bodyText(page);
      const onLogin = page.url().includes("/login");
      const renders = text.length > 50 && /persetujuan|consent/i.test(text);
      record(
        `F1B-07-${w}`,
        "F1-B Public route",
        `halaman consent publik terbuka tanpa sesi @${w}x${h}`,
        renders && !onLogin ? "PASS" : "FAIL",
        `onLogin=${onLogin} len=${text.length}`
      );

      const verifyCalls = reporter.requests
        .slice(before)
        .filter((r) => /public\/consents\/verify|consents\/verify/.test(r.url));
      record(
        `F1B-08-${w}`,
        "F1-C Consent honesty",
        `membuka halaman consent TIDAK memanggil verify (tidak memutasi token) @${w}x${h}`,
        verifyCalls.length === 0 ? "PASS" : "FAIL",
        `verifyCalls=${verifyCalls.length}`
      );

      const decisionButtons =
        (await page.getByRole("button", { name: "Saya setuju" }).isVisible().catch(() => false)) &&
        (await page.getByRole("button", { name: "Saya menolak" }).isVisible().catch(() => false));
      record(
        `F1B-09-${w}`,
        "F1-B Public route",
        `tombol keputusan consent tersedia (menunggu aksi pengguna) @${w}x${h}`,
        decisionButtons ? "PASS" : "FAIL",
        `setuju+menolak=${decisionButtons}`
      );

      const leak = /SOAP|diagnosis|ICD-10|resep|vital|hasil lab/i.test(text);
      record(
        `F1B-10-${w}`,
        "F1-B Public route",
        `halaman publik tidak membocorkan data klinis @${w}x${h}`,
        !leak ? "PASS" : "FAIL",
        `clinicalLeak=${leak}`
      );

      await reporter.shot(page, `public-consent-${w}x${h}`);
    } finally {
      await context.close();
    }
  }

  // --- F1B-7: /verify/[token] publik dengan token placeholder ---
  {
    const { context, page } = await newPage(browser, [390, 844], "ui-verify");
    try {
      await page.goto(`${BASE}/verify/token-tidak-dikenal-e2e`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const text = await bodyText(page);
      record(
        "F1B-11",
        "F1-B Public route",
        "/verify/[token] invalid ditangani (bukan blank / bukan redirect login)",
        text.length > 30 && !page.url().includes("/login") ? "PASS" : "FAIL",
        `url=${page.url()} len=${text.length}`
      );
      await reporter.shot(page, "verify-invalid-390x844");
    } finally {
      await context.close();
    }
  }

  // --- F1B-8: route terproteksi TANPA sesi -> /login (middleware) ---
  for (const route of ["/dashboard", "/mcu", "/people", "/health-status"]) {
    const { context, page } = await newPage(browser, [1280, 800], `ui-guard-${route}`);
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const url = new URL(page.url());
      record(
        `F1B-12-${route}`,
        "F1-B Route guard",
        `${route} tanpa sesi diarahkan ke /login`,
        url.pathname === "/login" ? "PASS" : "FAIL",
        `url=${url.pathname}${url.search}`
      );
    } finally {
      await context.close();
    }
  }

  // --- F1B-9: AccessDenied/error shell dapat dibuka tanpa API ---
  {
    const { context, page } = await newPage(browser, [1280, 800], "ui-error-shell");
    try {
      await page.setContent(
        `<html><body><div id="root"></div></body></html>`,
        { waitUntil: "domcontentloaded" }
      );
      // Shell error murni CSS/HTML: tidak boleh blank, tidak boleh request API.
      const before = reporter.requests.length;
      await page.goto(`${BASE}/login?from=%2Fdashboard`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const text = await bodyText(page);
      record(
        "F1B-13",
        "F1-B Route guard",
        "login dengan ?from internal tampil normal (tidak blank / tidak loop redirect)",
        text.length > 30 && !page.url().includes("from=%2Flogin") ? "PASS" : "FAIL",
        `url=${page.url()} len=${text.length}`
      );
      record(
        "F1B-14",
        "F1-B Route guard",
        "tidak ada redirect loop (jumlah navigasi wajar)",
        reporter.requests.length - before < 40 ? "PASS" : "FAIL",
        `requests=${reporter.requests.length - before}`
      );
    } finally {
      await context.close();
    }
  }

  // --- F1B-10: rute tidak dikenal tidak crash ---
  {
    const { context, page } = await newPage(browser, [768, 1024], "ui-404");
    try {
      // Route publik yang tidak ada -> 404 nyata dari Next (middleware dilewati).
      const res = await page.goto(`${BASE}/public/halaman-tidak-ada-e2e`, {
        waitUntil: "domcontentloaded",
      });
      await waitIdle(page);
      const text = await bodyText(page);
      const status = res ? res.status() : 0;
      record(
        "F1B-15",
        "F1-B Error shell",
        "rute publik tidak dikenal menampilkan 404 yang tertangani",
        status === 404 || /404|tidak ditemukan/i.test(text) ? "PASS" : "FAIL",
        `status=${status} len=${text.length}`
      );
      await reporter.shot(page, "not-found-768x1024");
    } finally {
      await context.close();
    }
  }

  // --- F1B-17: rute internal tidak dikenal tanpa sesi -> /login (bukan blank) ---
  {
    const { context, page } = await newPage(browser, [1280, 800], "ui-unknown-protected");
    try {
      await page.goto(`${BASE}/halaman-tidak-ada-e2e`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const text = await bodyText(page);
      record(
        "F1B-18",
        "F1-B Error shell",
        "rute internal tidak dikenal tanpa sesi diarahkan ke /login (tidak blank/crash)",
        page.url().includes("/login") && text.length > 30 ? "PASS" : "FAIL",
        `url=${new URL(page.url()).pathname} len=${text.length}`
      );
    } finally {
      await context.close();
    }
  }
}

// ---------------------------------------------------------------------------
// MODE contract — UI HSE acknowledgement dengan mock network (tanpa backend)
// ---------------------------------------------------------------------------
const RESTRICTIONS = [
  { id: "rest-1", description: "Hindari shift malam", review_date: "2026-12-01", status: "ACTIVE" },
  { id: "rest-2", description: "Batasi angkat beban > 10 kg", review_date: "2027-01-15", status: "ACTIVE" },
  { id: "rest-3", description: "Wajib pemeriksaan audiometri berkala", review_date: "2027-02-20", status: "ACTIVE" },
  { id: "rest-closed", description: "Sudah dicabut Dokter OH", review_date: "2026-01-01", status: "CLOSED" },
];

function envelope(data, meta) {
  return {
    success: true,
    statusCode: 200,
    message: "Operation completed successfully",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

function cyclesMock() {
  return [
    {
      id: "cycle-1",
      patient_id: "p-1",
      mcu_type: "ANNUAL_PERIODIC",
      examination_date: "2026-09-01T00:00:00.000Z",
      status: "COMPLETED",
      patient: {
        id: "p-1",
        full_name: "E2E Contract Worker",
        medical_record_no: "MRN-E2E-0001",
        employee: { employee_no: "E2E-CON-001", full_name: "E2E Contract Worker", site: null },
      },
      ftw_assessment: { id: "ftw-1", ftw_status: "FIT_WITH_RESTRICTION", restrictions: RESTRICTIONS },
    },
  ];
}

async function installApiMocks(page, state) {
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const method = req.method();
    state.calls.push({ method, path: p, at: Date.now() });

    if (p.endsWith("/auth/login")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            accessToken: "mock.jwt.token",
            refreshToken: "mock.refresh.token",
            expiresIn: 3600,
            user: {
              id: state.userId,
              username: state.username,
              roles: state.roles,
              isMedicalRole: state.isMedicalRole ?? false,
            },
          })
        ),
      });
    }

    if (p.endsWith("/mcu/cycles")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope(cyclesMock(), { page: 1, limit: 100, total: 1, totalPages: 1 })),
      });
    }

    if (/\/mcu\/restrictions\/([^/]+)\/acknowledge$/.test(p)) {
      const id = p.split("/").slice(-2)[0];
      state.ackCalls.push(id);
      if (state.failAckIds.has(id)) {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            statusCode: 500,
            error: "Internal Server Error",
            message: "Acknowledgement gagal disimpan pada server.",
          }),
        });
      }
      // delay kecil supaya status "submitting" dapat diamati
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            id: `ack-${id}`,
            restriction_id: id,
            user_id: state.userId,
            acknowledgement_type: "HSE",
            note: null,
            acknowledged_at: "2026-10-13T03:04:05.000Z",
          })
        ),
      });
    }

    // Default: envelope kosong agar shell tetap tenang (tidak ada backend baru).
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([])),
    });
  });
}

async function loginWithMock(page, { username, roles, userId = "u-contract", isMedicalRole }) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await waitIdle(page);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("mock-password-tidak-disimpan");
  await page.getByRole("button", { name: "Masuk" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await waitIdle(page);
  return { username, roles, userId, isMedicalRole };
}

async function runContract(browser) {
  // --- F2-A: HSE dapat melihat & menjalankan acknowledgement ---
  {
    const state = {
      userId: "u-contract-hse",
      username: "hse.officer",
      roles: ["HSE_OFFICER"],
      calls: [],
      ackCalls: [],
      failAckIds: new Set(["rest-2"]),
    };
    const { context, page } = await newPage(browser, [1280, 800], "contract-hse");
    try {
      await installApiMocks(page, state);
      await loginWithMock(page, state);
      record("F2A-00", "frontend-contract-test", "login HSE (mock network) berhasil", "PASS", `user=${state.username}`);

      await page.goto(`${BASE}/health-status`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);

      const section = page.locator('[data-testid="hse-restriction-acknowledgement"]');
      record(
        "F2A-01",
        "frontend-contract-test",
        "HSE melihat section acknowledgement restriksi",
        (await section.count()) === 1 ? "PASS" : "FAIL",
        `sections=${await section.count()}`
      );

      await page.locator('[data-testid="restriction-rest-1"]').waitFor({ timeout: 15000 });
      const rows = await page.locator('[data-testid^="restriction-rest"]').count();
      const ackButtons = await page.locator('[data-testid="ack-button"]').count();
      record(
        "F2A-02",
        "frontend-contract-test",
        "restriksi aktif dari API ditampilkan (restriksi CLOSED difilter)",
        rows === 3 && ackButtons === 3 ? "PASS" : "FAIL",
        `rows=${rows} ackButtons=${ackButtons} (mock punya 4, 1 CLOSED)`
      );

      const closedVisible = await page.locator('[data-testid="restriction-rest-closed"]').count();
      record(
        "F2A-03",
        "frontend-contract-test",
        "restriksi CLOSED tidak ditawarkan untuk di-acknowledge",
        closedVisible === 0 ? "PASS" : "FAIL",
        `closedRows=${closedVisible}`
      );

      record(
        "F2A-04",
        "frontend-contract-test",
        "membuka halaman TIDAK mengirim acknowledgement (tidak ada mutasi saat load)",
        state.ackCalls.length === 0 ? "PASS" : "FAIL",
        `ackCalls=${state.ackCalls.length}`
      );

      await reporter.shot(page, "hse-ack-list");

      // Confirmation dialog + submit state
      await page.locator('[data-testid="restriction-rest-1"] [data-testid="ack-button"]').click();
      const dialog = page.getByRole("dialog");
      const dialogVisible = await dialog.isVisible().catch(() => false);
      record(
        "F2A-05",
        "frontend-contract-test",
        "confirmation dialog tampil sebelum kirim",
        dialogVisible ? "PASS" : "FAIL",
        `dialog=${dialogVisible}`
      );
      await reporter.shot(page, "hse-ack-confirm");
      record(
        "F2A-06",
        "frontend-contract-test",
        "belum ada request sebelum konfirmasi ditekan",
        state.ackCalls.length === 0 ? "PASS" : "FAIL",
        `ackCalls=${state.ackCalls.length}`
      );

      await page.locator('[data-testid="ack-confirm"]').click();
      const submittingSeen = await page
        .locator('[data-testid="restriction-rest-1"][data-ack-state="submitting"]')
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      record(
        "F2A-07",
        "frontend-contract-test",
        "status submitting tampil selama request berjalan",
        submittingSeen ? "PASS" : "FAIL",
        `submittingSeen=${submittingSeen}`
      );

      const acknowledged = await page
        .locator('[data-testid="restriction-rest-1"][data-ack-state="acknowledged"]')
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      const ackText = await page
        .locator('[data-testid="restriction-rest-1"] [data-testid="ack-status"]')
        .innerText()
        .catch(() => "");
      record(
        "F2A-08",
        "frontend-contract-test",
        "success HANYA setelah response API sukses (timestamp dari backend)",
        acknowledged && /Acknowledged/.test(ackText) ? "PASS" : "FAIL",
        `state=acknowledged badge="${ackText.trim()}"`
      );

      const note = page.locator('[data-testid="restriction-rest-1"] [data-testid="ack-persistence-note"]');
      const noteText = (await note.innerText().catch(() => "")) || "";
      record(
        "F2A-09",
        "frontend-contract-test",
        "keterbatasan persistence ditampilkan jujur (bukan fake persistence)",
        (await note.count()) === 1 && /belum dapat diverifikasi oleh API/i.test(noteText)
          ? "PASS"
          : "FAIL",
        `note="${noteText.trim().slice(0, 60)}"`
      );
      await reporter.shot(page, "hse-ack-success");

      // Error + retry
      await page.locator('[data-testid="restriction-rest-2"] [data-testid="ack-button"]').click();
      await page.locator('[data-testid="ack-confirm"]').click();
      const failed = await page
        .locator('[data-testid="restriction-rest-2"][data-ack-state="failed"]')
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      const errorText = await page
        .locator('[data-testid="restriction-rest-2"]')
        .innerText()
        .catch(() => "");
      record(
        "F2A-10",
        "frontend-contract-test",
        "kegagalan API (500) tampil sebagai error, bukan success",
        failed && /gagal/i.test(errorText) ? "PASS" : "FAIL",
        `failed=${failed} snippet="${errorText.replace(/\s+/g, " ").slice(0, 80)}"`
      );
      await reporter.shot(page, "hse-ack-error");

      state.failAckIds.delete("rest-2");
      await page.locator('[data-testid="restriction-rest-2"] [data-testid="ack-button"]').click();
      await page.locator('[data-testid="ack-confirm"]').click();
      const retryOk = await page
        .locator('[data-testid="restriction-rest-2"][data-ack-state="acknowledged"]')
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      record(
        "F2A-11",
        "frontend-contract-test",
        "retry setelah gagal aman dan tidak menggandakan request berlebih",
        retryOk && state.ackCalls.filter((id) => id === "rest-2").length === 2
          ? "PASS"
          : "FAIL",
        `retryOk=${retryOk} ackCalls(rest-2)=${state.ackCalls.filter((id) => id === "rest-2").length}`
      );

      // Anti double-click pada satu restriksi yang sama
      const rest3CallsBefore = state.ackCalls.filter((id) => id === "rest-3").length;
      await page.locator('[data-testid="restriction-rest-3"] [data-testid="ack-button"]').click();
      const confirm = page.locator('[data-testid="ack-confirm"]');
      await confirm.click();
      await confirm.click({ force: true, timeout: 2000 }).catch(() => {});
      await page
        .locator('[data-testid="restriction-rest-3"][data-ack-state="acknowledged"]')
        .waitFor({ timeout: 15000 })
        .catch(() => {});
      const rest3Calls = state.ackCalls.filter((id) => id === "rest-3").length - rest3CallsBefore;
      record(
        "F2A-12",
        "frontend-contract-test",
        "double-click tidak mengirim request ganda (aman di sisi frontend)",
        rest3Calls === 1 ? "PASS" : "FAIL",
        `requests(rest-3)=${rest3Calls}`
      );

      const overflow = await horizontalOverflow(page);
      record(
        "F2A-13",
        "frontend-contract-test",
        "section acknowledgement tidak menyebabkan overflow horizontal (1280x800)",
        overflow.overflow <= 1 ? "PASS" : "FAIL",
        `overflow=${overflow.overflow}px`
      );
    } finally {
      await context.close();
    }
  }

  // --- F2-A: role non-HSE tidak melihat action ---
  for (const role of [
    { username: "dr.hendra", roles: ["DOCTOR_OH"], isMedicalRole: true, id: "u-contract-oh" },
    { username: "hr.pic", roles: ["HR_ADMIN"], id: "u-contract-hr" },
    { username: "perawat", roles: ["NURSE"], id: "u-contract-nurse" },
  ]) {
    const state = {
      userId: role.id,
      username: role.username,
      roles: role.roles,
      isMedicalRole: role.isMedicalRole,
      calls: [],
      ackCalls: [],
      failAckIds: new Set(),
    };
    const { context, page } = await newPage(browser, [1280, 800], `contract-${role.username}`);
    try {
      await installApiMocks(page, state);
      await loginWithMock(page, state);
      await page.goto(`${BASE}/health-status`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);

      const sections = await page.locator('[data-testid="hse-restriction-acknowledgement"]').count();
      const buttons = await page.locator('[data-testid="ack-button"]').count();
      record(
        `F2A-14-${role.username}`,
        "frontend-contract-test",
        `role non-HSE (${role.roles[0]}) tidak melihat section/aksi acknowledgement`,
        sections === 0 && buttons === 0 ? "PASS" : "FAIL",
        `sections=${sections} ackButtons=${buttons}`
      );

      const pageText = await bodyText(page);
      record(
        `F2A-15-${role.username}`,
        "frontend-contract-test",
        `halaman status kesehatan tetap dapat dibaca role ${role.roles[0]} (tanpa AccessDenied)`,
        /Status Kesehatan Kerja/i.test(pageText) ? "PASS" : "FAIL",
        `len=${pageText.length}`
      );
    } finally {
      await context.close();
    }
  }

  // --- F2-A: mobile ---
  {
    const state = {
      userId: "u-contract-hse-m",
      username: "hse.officer",
      roles: ["HSE_OFFICER"],
      calls: [],
      ackCalls: [],
      failAckIds: new Set(),
    };
    const { context, page } = await newPage(browser, [390, 844], "contract-hse-mobile");
    try {
      await installApiMocks(page, state);
      await loginWithMock(page, state);
      await page.goto(`${BASE}/health-status`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await page.locator('[data-testid="restriction-rest-1"]').waitFor({ timeout: 15000 }).catch(() => {});
      const overflow = await horizontalOverflow(page);
      record(
        "F2A-16",
        "frontend-contract-test",
        "section acknowledgement dapat dioperasikan di 390x844 tanpa overflow",
        overflow.overflow <= 1 && (await page.locator('[data-testid="ack-button"]').count()) >= 1
          ? "PASS"
          : "FAIL",
        `overflow=${overflow.overflow}px ackButtons=${await page.locator('[data-testid="ack-button"]').count()}`
      );

      await page.locator('[data-testid="restriction-rest-1"] [data-testid="ack-button"]').click();
      const dialogBox = await page.getByRole("dialog").boundingBox();
      const dialogInside = Boolean(
        dialogBox && dialogBox.x >= -1 && dialogBox.x + dialogBox.width <= 391
      );
      record(
        "F2A-17",
        "frontend-contract-test",
        "modal konfirmasi tidak keluar viewport mobile 390x844",
        dialogInside ? "PASS" : "FAIL",
        dialogBox ? `x=${Math.round(dialogBox.x)} w=${Math.round(dialogBox.width)}` : "no dialog"
      );
      await reporter.shot(page, "hse-ack-390x844");
    } finally {
      await context.close();
    }
  }
}

// ---------------------------------------------------------------------------
// MODE business — mendelegasikan ke suite bisnis yang SUDAH ada
// ---------------------------------------------------------------------------
async function checkBackend() {
  if (!API_URL) return { ok: false, reason: "E2E_API_URL tidak diset" };
  try {
    const root = API_URL.replace(/\/api\/v1$/, "");
    const res = await fetch(`${root}/health/liveness`);
    if (!res.ok) return { ok: false, reason: `health/liveness status ${res.status}` };
    const body = await res.json().catch(() => null);
    const status = body?.data?.status ?? body?.status;
    if (typeof status !== "string") return { ok: false, reason: "respons health bukan envelope backend" };
    return { ok: true, reason: `status=${status}` };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

function runChild(script, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function runBusiness() {
  const health = await checkBackend();
  if (!health.ok) {
    record(
      "F1A-BIZ-01",
      "business-with-existing-backend",
      "backend nyata tersedia untuk mode business",
      "BLOCKED",
      `${health.reason} (jalankan dengan E2E_API_URL ke backend nyata)`,
      { category: "ENVIRONMENT_BLOCKER" }
    );
    return 1;
  }
  record(
    "F1A-BIZ-01",
    "business-with-existing-backend",
    "backend nyata terdeteksi (tanpa membuat backend baru)",
    "PASS",
    `${API_URL} → ${health.reason}`
  );

  const suite = path.join("e2e", "fase2-identity-mcu-staging.mjs");
  const code = await runChild(suite, { E2E_BASE_URL: BASE, E2E_API_URL: API_URL });
  record(
    "F1A-BIZ-02",
    "business-with-existing-backend",
    "suite bisnis fase 2 dieksekusi terhadap backend nyata",
    code === 0 ? "PASS" : "FAIL",
    `${suite} exit=${code} (detail di test-artifacts/e2e-f2/browser-e2e-report.json)`
  );
  return code === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Frontend E2E (mode: ${MODE}) ===`);
  console.log(`base=${BASE} api=${API_URL || "-"} out=${ensureDir(OUT)}\n`);

  if (MODE === "business") {
    const code = await runBusiness();
    const { file, summary } = reporter.write();
    console.log(
      `\nHasil: ${summary.totals.passed} PASS · ${summary.totals.failed} FAIL · ${summary.totals.blocked} BLOCKED`
    );
    console.log(`Report: ${file}`);
    process.exit(code);
  }

  const playwright = loadPlaywright();
  const { browser, launch } = await launchBrowser(playwright);
  console.log(`browser: ${JSON.stringify(launch)}\n`);

  try {
    if (MODE === "ui-only" || MODE === "all") await runUiOnly(browser);
    if (MODE === "contract" || MODE === "all") {
      await runContract(browser);
      const ctx = { browser, reporter, record, BASE, newPage, bodyText, waitIdle, horizontalOverflow };
      await runContractConsent(ctx);
      await runContractPeople(ctx);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // Ringkasan error yang tidak boleh muncul
  record(
    "F1B-16",
    "F1-B Error shell",
    "unexpected page error = 0",
    reporter.pageErrors.length === 0 ? "PASS" : "FAIL",
    reporter.pageErrors.slice(0, 3).join(" | ")
  );
  record(
    "F1B-17",
    "F1-B Error shell",
    "unexpected console error = 0",
    reporter.consoleErrors.length === 0 ? "PASS" : "FAIL",
    reporter.consoleErrors.slice(0, 3).join(" | ")
  );

  const { file, summary } = reporter.write();
  console.log(
    `\nHasil: ${summary.totals.total} skenario — ${summary.totals.passed} PASS · ${summary.totals.failed} FAIL · ${summary.totals.blocked} BLOCKED`
  );
  console.log(`Page error: ${reporter.pageErrors.length} · console error tak terduga: ${reporter.consoleErrors.length}`);
  console.log(`Report: ${file}`);
  process.exit(summary.totals.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\nFATAL: ${e?.stack || e}`);
  process.exit(2);
});
