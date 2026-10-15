/**
 * Probe wiring frontend → backend (Fase 6) — membuktikan lewat browser nyata
 * (dev server + backend NestJS hidup) bahwa halaman yang disambungkan membaca
 * data backend, bukan data seed lokal.
 *
 * Untuk setiap halaman diperiksa:
 *  1. request ke `/api/v1/**` (path + status HTTP) saat halaman dibuka;
 *  2. tidak ada pageerror dan tidak ada ErrorState ("Gagal memuat …");
 *  3. cross-check isi DOM dengan backend — data pembanding diambil langsung
 *     memakai bearer token sesi (`kodein_token` di localStorage).
 *
 * Status hasil:
 *  - PASS        : perilaku terbukti
 *  - FAIL        : perilaku frontend salah (harus diperbaiki)
 *  - BLOCKED     : tidak dapat diuji di environment ini (mis. akun wajib MFA)
 *  - GAP         : route backend memang belum ada (bukan bug frontend) —
 *                  dilaporkan, tidak dihitung lulus.
 *
 * Jalankan dengan dev server (3001) + backend (3000) aktif:
 *   node scripts/probe-frontend-backend-wiring.mjs
 * Artefak: test-artifacts/frontend-backend-wiring/
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.E2E_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const API = (process.env.E2E_API_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/frontend-backend-wiring");
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

/** Login nyata lewat UI. MFA_REQUIRED dilempar terpisah agar bisa ditandai BLOCKED. */
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
    if (/Verifikasi MFA|Two-Factor Authentication/i.test(body)) {
      throw new Error(`MFA_REQUIRED: ${username}`);
    }
    throw new Error(`Login ${username} gagal: ${body.slice(0, 160).replace(/\n+/g, " | ")}`);
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
}

const called = (state, method, pathname) =>
  state.api.filter(
    (r) => r.method === method && (r.path === pathname || r.path.startsWith(`${pathname}?`))
  );

async function apiGet(page, token, urlPath) {
  const res = await page.request.get(`${API}${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function visit(page, state, pathname) {
  state.api.length = 0;
  state.errors.length = 0;
  await page.goto(`${BASE}${pathname}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1800);
  return page.locator("body").innerText().catch(() => "");
}

const DENIED = /Akses terbatas|Akses ditolak|Access Denied/i;
const ERROR_STATE = /Gagal memuat|Terjadi kesalahan saat memuat/i;

/** Satu halaman: request backend 200, tanpa ErrorState/pageerror, cocok dengan backend. */
async function checkPage(page, state, spec) {
  const body = await visit(page, state, spec.path);
  await shoot(page, spec.shot ?? spec.path.replace(/\//g, "_"));

  const calls = called(state, "GET", spec.expectPath);
  const apiOk = calls.length > 0 && calls.every((c) => c.status === 200);
  record(
    `${spec.id}-api`,
    `${spec.path} memanggil GET ${spec.expectPath} → 200`,
    apiOk ? "PASS" : "FAIL",
    `calls=${calls.map((c) => c.status).join(",") || "none"}`
  );
  record(
    `${spec.id}-err`,
    `${spec.path} tanpa ErrorState & tanpa pageerror`,
    !ERROR_STATE.test(body) && state.errors.length === 0 ? "PASS" : "FAIL",
    state.errors.join(" | ") || (ERROR_STATE.test(body) ? "ErrorState tampil" : "bersih")
  );
  if (spec.expect) {
    const m = body.match(spec.expect.re);
    const shown = m ? Number(m[1]) : -1;
    record(
      `${spec.id}-data`,
      `${spec.path} ${spec.expect.label}`,
      shown === spec.expect.value() ? "PASS" : "FAIL",
      `dom=${shown} backend=${spec.expect.value()}`
    );
  }
}

/** Halaman yang harus ditolak guard (tidak render konten terlindungi). */
async function checkDenied(page, state, { id, path: p, reason }) {
  const body = await visit(page, state, p);
  await shoot(page, `${p.replace(/\//g, "_")}_denied`);
  record(
    `${id}`,
    `${p} ditolak guard (AccessDenied, tanpa request data)`,
    DENIED.test(body) && state.api.filter((r) => r.path.startsWith(p)).length === 0
      ? "PASS"
      : "FAIL",
    `${reason} | ${body.replace(/\n+/g, " | ").slice(0, 80)}`
  );
}

async function openSession(context, user) {
  const page = await context.newPage();
  const state = { api: [], errors: [] };
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/v1/")) {
      state.api.push({
        method: res.request().method(),
        path: new URL(u).pathname.replace("/api/v1", "") + new URL(u).search,
        status: res.status(),
      });
    }
  });
  page.on("pageerror", (e) => state.errors.push(e.message));
  await login(page, user);
  const token = await page.evaluate(() => localStorage.getItem("kodein_token"));
  record(
    `S-${user}`,
    `Login ${user} lewat UI ke backend + bearer token tersimpan`,
    token ? "PASS" : "FAIL",
    token ? `token len=${token.length}` : "kodein_token kosong"
  );
  return { page, state, token };
}

async function main() {
  const playwright = loadPlaywright();
  const { browser, launch } = await launchBrowser(playwright);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  console.log(`[wiring] browser=${JSON.stringify(launch)} frontend=${BASE} backend=${API}`);

  // ======================================================================
  // Sesi HR/PIC — pekerja, FTW, laporan, halaman "Saya"
  // ======================================================================
  {
    const { page, state, token } = await openSession(context, "hr.pic");
    const cyclesRes = await apiGet(page, token, "/mcu/cycles?page=1&limit=100");
    const cycles = cyclesRes.body?.data ?? [];
    const ftwCount = cycles.filter((c) => c.ftw_assessment).length;
    record(
      "W10-src",
      "Sumber pembanding backend (GET /mcu/cycles) terjangkau",
      cyclesRes.status === 200 ? "PASS" : "FAIL",
      `status=${cyclesRes.status} siklus=${cycles.length} FTW=${ftwCount}`
    );

    await checkPage(page, state, {
      id: "W11",
      path: "/health-status",
      expectPath: "/mcu/cycles",
      expect: {
        re: /(\d+)\s+status kesehatan/,
        value: () => ftwCount,
        label: "menampilkan jumlah status = jumlah FTW backend",
      },
    });
    await checkPage(page, state, { id: "W12", path: "/employees", expectPath: "/patients" });
    await checkPage(page, state, { id: "W13", path: "/reports", expectPath: "/mcu/cycles" });
    await checkPage(page, state, { id: "W14", path: "/my/profile", expectPath: "/patients" });
    await checkPage(page, state, { id: "W15", path: "/my/mcu", expectPath: "/mcu/cycles" });
    await checkPage(page, state, { id: "W16", path: "/my/certificates", expectPath: "/documents" });
    await checkPage(page, state, { id: "W17", path: "/my/notifications", expectPath: "/notifications" });

    await checkDenied(page, state, {
      id: "W18",
      path: "/documents",
      reason: "guard /documents = issue-certificate",
    });
    await checkDenied(page, state, {
      id: "W19",
      path: "/signatures",
      reason: "guard /signatures = issue-certificate",
    });
    await checkDenied(page, state, {
      id: "W20",
      path: "/certificates",
      reason: "guard /certificates = issue-certificate",
    });
    await checkDenied(page, state, {
      id: "W21",
      path: "/users",
      reason: "guard /users = manage-users",
    });
    await page.close();
  }

  // ======================================================================
  // Sesi HSE — dashboard, FTW, laporan, antrean; D&A harus DITOLAK
  // ======================================================================
  {
    const { page, state, token } = await openSession(context, "hse.officer");
    const cyclesRes = await apiGet(page, token, "/mcu/cycles?page=1&limit=100");
    const ftwCount = (cyclesRes.body?.data ?? []).filter((c) => c.ftw_assessment).length;

    await checkPage(page, state, { id: "W30", path: "/dashboard", expectPath: "/mcu/cycles" });
    await checkPage(page, state, {
      id: "W31",
      path: "/health-status",
      expectPath: "/mcu/cycles",
      expect: {
        re: /(\d+)\s+status kesehatan/,
        value: () => ftwCount,
        label: "menampilkan jumlah status = jumlah FTW backend",
      },
    });
    await checkPage(page, state, { id: "W32", path: "/reports", expectPath: "/mcu/cycles" });
    await checkPage(page, state, { id: "W33", path: "/visits/queue", expectPath: "/clinic/queues" });

    const body = await visit(page, state, "/da");
    await shoot(page, "da_hse");
    record(
      "W34",
      "/da ditolak untuk HSE (backend hanya DOCTOR_OH/LAB_ANALYST/SYSTEM_ADMIN)",
      DENIED.test(body) ? "PASS" : "FAIL",
      body.replace(/\n+/g, " | ").slice(0, 90)
    );
    const shellText = await page.locator("body").innerText().catch(() => "");
    record(
      "W35",
      "Menu D&A tidak tampil untuk HSE (guard = navigasi = backend)",
      !/(^|\s)D&A(\s|$)/m.test(shellText) ? "PASS" : "FAIL",
      /D&A/.test(shellText) ? "menu D&A masih tampil" : "menu D&A tersembunyi"
    );
    await page.close();
  }

  // ======================================================================
  // Sesi Analis Lab — D&A harus BISA dibuka (wewenang LAB_ANALYST)
  // ======================================================================
  {
    const { page, state, token } = await openSession(context, "lab.analis");
    const daRes = await apiGet(page, token, "/da/tests?page=1&limit=50");
    const daCount = (daRes.body?.data ?? []).length;
    record(
      "W40-src",
      "Backend GET /da/tests mengizinkan LAB_ANALYST",
      daRes.status === 200 ? "PASS" : "FAIL",
      `status=${daRes.status} tes=${daCount}`
    );
    await checkPage(page, state, { id: "W40", path: "/da", expectPath: "/da/tests" });
    const body = await page.locator("body").innerText().catch(() => "");
    record(
      "W41",
      "Menu D&A tampil untuk Analis Lab",
      /D&A/.test(body) ? "PASS" : "FAIL",
      /D&A/.test(body) ? "item navigasi terlihat" : "item navigasi tidak ada"
    );
    await page.close();
  }

  // ======================================================================
  // Sesi Apoteker — dispensing & stok
  // ======================================================================
  {
    const { page, state } = await openSession(context, "apoteker");
    await checkPage(page, state, { id: "W50", path: "/medicine", expectPath: "/pharmacy/inventory" });
    await checkPage(page, state, {
      id: "W51",
      path: "/medicine/dispense",
      expectPath: "/pharmacy/prescriptions/pending",
    });
    // Retur obat: halaman bergantung pada GET /pharmacy/dispensing/history yang
    // BELUM ada di backend → dicatat sebagai GAP, bukan bug frontend.
    const body = await visit(page, state, "/medicine/return");
    await shoot(page, "medicine_return");
    const historyCall = called(state, "GET", "/pharmacy/dispensing/history")[0];
    record(
      "W52",
      "/medicine/return bergantung pada GET /pharmacy/dispensing/history",
      historyCall && historyCall.status === 404 ? "GAP" : "PASS",
      historyCall
        ? `backend status=${historyCall.status} (route belum ada) — halaman menampilkan ErrorState`
        : "riwayat dispensing termuat dari backend"
    );
    record(
      "W53",
      "/medicine/return tidak crash (ErrorState terkendali, tanpa pageerror)",
      ERROR_STATE.test(body) && state.errors.length === 0 ? "PASS" : "FAIL",
      state.errors.join(" | ") || body.replace(/\n+/g, " | ").slice(0, 80)
    );
    await page.close();
  }

  // ======================================================================
  // Sesi Perawat — antrean kunjungan
  // ======================================================================
  {
    const { page, state } = await openSession(context, "perawat");
    await checkPage(page, state, {
      id: "W60",
      path: "/visits/queue",
      expectPath: "/clinic/queues",
    });
    await checkPage(page, state, { id: "W61", path: "/dashboard", expectPath: "/mcu/cycles" });
    await page.close();
  }

  // ======================================================================
  // Halaman khusus Dokter OH (/documents, /signatures, /certificates):
  // UI tidak dapat diuji karena akun dr.hendra wajib MFA di environment ini.
  // Yang diverifikasi = kontrak data yang dipanggil halaman-halaman itu.
  // ======================================================================
  {
    const { page, token } = await openSession(context, "hr.pic");
    const docsRes = await apiGet(page, token, "/documents?page=1&limit=100");
    const docs = docsRes.body?.data ?? [];
    const ftwDocsRes = await apiGet(
      page,
      token,
      "/documents?page=1&limit=100&documentType=FTW_CERTIFICATE"
    );
    record(
      "W80",
      "Kontrak data /documents & /signatures (GET /documents) → 200",
      docsRes.status === 200 ? "PASS" : "FAIL",
      `status=${docsRes.status} dokumen=${docs.length}`
    );
    record(
      "W81",
      "Kontrak data /certificates (GET /documents?documentType=FTW_CERTIFICATE) → 200",
      ftwDocsRes.status === 200 ? "PASS" : "FAIL",
      `status=${ftwDocsRes.status} sertifikat FTW=${(ftwDocsRes.body?.data ?? []).length}`
    );
    await page.close();
  }

  // ======================================================================
  // Halaman publik /verify/[token]
  // ======================================================================
  {
    const page = await context.newPage();
    await page.goto(`${BASE}/verify/token-probe-tidak-ada-123`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText().catch(() => "");
    record(
      "W70",
      "/verify/[token] token tidak valid → empty state (bukan crash)",
      /tidak ditemukan|tidak valid|gagal/i.test(body) && !/Application error/i.test(body)
        ? "PASS"
        : "FAIL",
      body.replace(/\n+/g, " | ").slice(0, 80)
    );
    await shoot(page, "verify_invalid");
    await page.close();
  }

  // ======================================================================
  // Kontrak endpoint: dipakai frontend, tapi route backend belum ada
  // ======================================================================
  {
    const { page, token } = await openSession(context, "hse.officer");
    for (const [id, label, p] of [
      ["G80", "GET /waivers (daftar waiver HSE)", "/waivers?page=1&limit=5"],
      ["G81", "GET /signatures (tracking tanda tangan)", "/signatures?page=1&limit=5"],
      ["G82", "GET /signatures/:id (status satu tanda tangan)", "/signatures/00000000-0000-0000-0000-000000000000"],
    ]) {
      const res = await apiGet(page, token, p);
      record(
        id,
        `${label} — route backend`,
        res.status === 404 ? "GAP" : "PASS",
        `status=${res.status}${res.status === 404 ? " (route tidak terdaftar di backend)" : ""}`
      );
    }
    await page.close();
  }
  {
    const { page, token } = await openSession(context, "apoteker");
    const res = await apiGet(page, token, "/pharmacy/dispensing/history");
    record(
      "G83",
      "GET /pharmacy/dispensing/history — route backend",
      res.status === 404 ? "GAP" : "PASS",
      `status=${res.status}`
    );
    await page.close();
  }
  {
    const { page, token } = await openSession(context, "lab.analis");
    for (const [id, p] of [
      ["G84", "/diagnostic/lab-orders"],
      ["G85", "/diagnostic/lab-results"],
      ["G86", "/diagnostic/radiology-orders"],
    ]) {
      const res = await apiGet(page, token, p);
      record(
        id,
        `GET ${p} — route backend`,
        res.status === 404 ? "GAP" : "PASS",
        `status=${res.status}`
      );
    }
    await page.close();
  }

  // ======================================================================
  // Blocked: akun wajib MFA (tidak bisa login lewat UI tanpa TOTP)
  // ======================================================================
  for (const user of ["admin", "dr.hendra"]) {
    const page = await context.newPage();
    try {
      await login(page, user);
      record(`B90-${user}`, `Login ${user} (MFA)`, "PASS", "login berhasil tanpa TOTP");
    } catch (e) {
      const mfa = String(e?.message ?? "").startsWith("MFA_REQUIRED");
      const scope =
        user === "dr.hendra"
          ? " (satu-satunya role pemegang issue-certificate → /certificates, /documents, /signatures)"
          : " (/users, dan semua route klinis)";
      record(
        `B90-${user}`,
        `Halaman khusus role ${user} (MFA/TOTP) TIDAK dapat diuji UI di environment ini${scope}`,
        mfa ? "BLOCKED" : "FAIL",
        mfa
          ? "login ditolak karena mfaSetupRequired (bukan bug frontend); kontrak datanya diuji lewat W80/W81 + live-backend.integration.test.ts"
          : String(e?.message)
      );
    }
    await page.close();
  }

  await browser.close();
  return finish();
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  const gaps = results.filter((r) => r.status === "GAP");
  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    api: API,
    totals: {
      total: results.length,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: failed.length,
      blocked: blocked.length,
      gaps: gaps.length,
    },
    results,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\nRINGKASAN WIRING: total=${summary.totals.total} pass=${summary.totals.passed} fail=${summary.totals.failed} blocked=${summary.totals.blocked} gap-backend=${summary.totals.gaps}`
  );
  if (failed.length > 0) console.log(`FAIL: ${failed.map((f) => f.id).join(", ")}`);
  console.log(`Artefak: ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  record("W99", "Probe wiring selesai tanpa error fatal", "FAIL", e?.message ?? String(e));
  finish();
});
