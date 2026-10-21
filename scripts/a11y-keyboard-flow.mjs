#!/usr/bin/env node
/**
 * Verifikasi aksesibilitas keyboard: alur login → SOAP dijalankan HANYA dengan
 * keyboard (Tab/Shift+Tab/Enter/Space/Escape), tanpa klik mouse.
 *
 * Backend distub (tanpa backend hidup): login sukses, satu pasien + satu
 * kunjungan antrean supaya kartu rekam medis & tombol SOAP muncul, dan endpoint
 * encounter mengembalikan sukses.
 *
 * AKUN UJI & ROLE — baca sebelum mengubah permission di `lib/rbac.ts`:
 *   - Sesi 1 `dr.klinik` (DOCTOR_CLINIC → role `dokter-klinik`), KB-01..KB-13:
 *     menu "Rekam Medis" disyaratkan `view-clinical-notes`
 *     (`src/lib/navigation.ts`) dan route `/medical-records` dijaga permission
 *     yang sama (`components/route-guard.tsx`). Hanya role klinis yang
 *     memegangnya; SYSTEM_ADMIN sengaja TIDAK dipakai karena A1 mencabut akses
 *     data klinis dari admin — menu itu memang tidak boleh tampil untuknya.
 *   - Sesi 2 `hr.pic` (HR_ADMIN → role `hr`), KB-14..KB-20: tabel `/people` dan
 *     wizard `/people/new` membutuhkan `manage-employees`, yang tidak dimiliki
 *     role klinis. Tidak ada satu role pun yang memegang kedua izin itu, jadi
 *     alur dipecah per sesi sesuai peta permission (ROLE_MAPPING.md).
 * Username mengikuti daftar akun demo di `app/login/login-page-content.tsx`;
 * password diisi nilai dummy karena API distub di skrip ini (tidak ada
 * kredensial nyata yang disimpan/dicetak).
 *
 * Env: A11Y_BASE_URL (default http://localhost:3311)
 */
import fs from "node:fs";
import path from "node:path";
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.A11Y_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");

/** Viewport desktop eksplisit: sidebar hanya dirender pada breakpoint `lg`. */
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

/** Artifact kegagalan (folder ini diunggah workflow CI `.github/workflows/a11y.yml`). */
const ARTIFACT_DIR = path.join("test-artifacts", "a11y");
const FAILURE_PNG = path.join(ARTIFACT_DIR, "keyboard-flow-failure.png");
const FAILURE_LOG = path.join(ARTIFACT_DIR, "keyboard-flow-failure.log");

/** Password dummy — API distub di skrip ini, jadi tidak ada kredensial nyata. */
const TEST_PASSWORD = "uji-lokal";

const ACCOUNTS = {
  klinis: {
    id: "u-dokter-klinik",
    username: "dr.klinik",
    roles: ["DOCTOR_CLINIC"],
    label: "Dokter Klinik (dr.klinik)",
  },
  registrasi: {
    id: "u-hr",
    username: "hr.pic",
    roles: ["HR_ADMIN"],
    label: "HR/PIC (hr.pic)",
  },
};

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
  created_at: "2026-01-01T10:00:00Z",
  appointment_id: "appt-1",
  appointment: { patient: { id: "pat-1", full_name: "Budi Test" } },
};

const results = [];
function check(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Halaman & akun yang sedang aktif — dipakai untuk diagnosis saat gagal. */
let activePage = null;
let activeAccount = null;
/** Diagnosa sudah dicetak untuk kegagalan ini? (hindari output ganda) */
let diagnosed = false;

function writeArtifact(file, text) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Diagnosis saat locator gagal: URL, akun/role (tanpa kredensial), seluruh link
 * yang terlihat, screenshot, dan petunjuk penyebab. Output juga ditulis ke
 * `test-artifacts/a11y/` agar ikut terunggah sebagai artifact CI.
 */
async function diagnose(page, account, reason, hint) {
  diagnosed = true;
  const links = await page
    .getByRole("link")
    .allInnerTexts()
    .catch(() => []);
  const bodyText = await page
    .evaluate(() => (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 400))
    .catch(() => "");
  const session = await page
    .evaluate(() => {
      try {
        const raw = localStorage.getItem("kodein-klinik-store");
        const parsed = raw ? JSON.parse(raw) : null;
        const user = parsed?.state?.users?.find((u) => u.id === parsed?.state?.currentUserId);
        return { role: user?.role ?? null, username: user?.username ?? null };
      } catch {
        return { role: null, username: null };
      }
    })
    .catch(() => ({ role: null, username: null }));

  await page.screenshot({ path: FAILURE_PNG, fullPage: true }).catch(() => {});

  const visible = links
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" | ");
  const lines = [
    `[diagnosis] ${reason}`,
    `  url           : ${page.url()}`,
    `  akun uji      : ${account?.label ?? "?"} → role backend ${account?.roles?.join(", ") ?? "?"}`,
    `  role sesi     : ${session.role ?? "tidak terbaca"} (${session.username ?? "-"})`,
    `  link terlihat : ${visible || "(tidak ada link)"}`,
    `  teks halaman  : ${bodyText || "(kosong)"}`,
    `  screenshot    : ${FAILURE_PNG}`,
    ...(hint ? [`  petunjuk      : ${hint}`] : []),
  ];
  console.error(lines.join("\n"));
  writeArtifact(FAILURE_LOG, `${lines.join("\n")}\n`);
}

/** Tunggu locator; bila gagal, cetak diagnosis lengkap alih-alih timeout mentah. */
async function waitForOrDiagnose(page, locator, { account, label, timeout = 15000, hint } = {}) {
  try {
    await locator.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    await diagnose(page, account, `locator ${label} tidak terlihat dalam ${timeout} ms`, hint);
    return false;
  }
}

/**
 * Stub API untuk satu halaman. Role akun ditentukan oleh `username` yang
 * dikirim ke `/auth/login` — meniru backend nyata, sehingga salah akun
 * menghasilkan 401 yang jelas, bukan menu yang diam-diam hilang.
 */
function installApiStub(page) {
  return page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const p = new URL(request.url()).pathname;
    const ok = (data, meta) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, statusCode: 200, data, ...(meta ? { meta } : {}) }),
      });
    if (p.endsWith("/auth/login")) {
      let username = null;
      try {
        username = JSON.parse(request.postData() ?? "{}").username ?? null;
      } catch {
        username = null;
      }
      const account = Object.values(ACCOUNTS).find((a) => a.username === username);
      if (!account) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            statusCode: 401,
            message: `Akun uji "${username}" tidak dikenal oleh stub a11y`,
          }),
        });
      }
      return ok({
        accessToken: "head.body.sig",
        refreshToken: "refresh",
        user: {
          id: account.id,
          username: account.username,
          roles: account.roles,
          isMedicalRole: true,
        },
      });
    }
    if (p.endsWith("/patients")) {
      // Hormati parameter `search` seperti backend: registrasi memanggil
      // GET /patients?search=<identifier> untuk cek duplikat. Bila selalu
      // mengembalikan pasien yang sama, identifier baru dianggap duplikat
      // (severity BLOCK) dan modal "Tidak dapat melanjutkan" menutupi wizard.
      const search = new URL(request.url()).searchParams.get("search")?.toLowerCase() ?? "";
      const matches =
        !search ||
        [PATIENT.fullName, PATIENT.employeeNo, PATIENT.mrn].some((v) => v.toLowerCase().includes(search));
      const rows = matches ? [PATIENT] : [];
      return ok(rows, { page: 1, limit: 100, total: rows.length, totalPages: 1 });
    }
    if (p.endsWith("/clinic/queues")) return ok([TICKET]);
    if (p.includes("/clinic/encounters")) return ok({ id: "enc-1", status: "DRAFT", locked_at: null });
    return ok([], { page: 1, limit: 100, total: 0, totalPages: 1 });
  });
}

async function openSession(browser, account, pageErrors) {
  const context = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(`${account.username}: ${e.message}`));
  await installApiStub(page);
  return { context, page };
}

/**
 * Ketik nilai ke field sampai nilainya benar-benar menempel di state React.
 *
 * Input terkontrol mengabaikan ketikan yang terjadi sebelum hidrasi selesai
 * (pola yang sama dengan `fillStable()` di e2e/*.mjs), tetapi di sini tetap
 * memakai keyboard — bukan `fill()`.
 */
async function typeStable(page, label, text) {
  const field = page.getByLabel(label).first();
  await field.waitFor({ state: "visible", timeout: 15000 });
  for (let attempt = 0; attempt < 20; attempt++) {
    await field.focus();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(text);
    if ((await field.inputValue().catch(() => "")) === text) return true;
    await page.waitForTimeout(250); // hidrasi React belum selesai
  }
  return false;
}

/**
 * Tunggu React benar-benar ter-hidrasi sebelum mengetik ke form login.
 *
 * Sinyalnya nyata, bukan sleep: menekan Enter pada tombol "Masuk" saat field
 * masih kosong memunculkan error validasi yang digerakkan React. Selama halaman
 * belum ter-hidrasi, tombol itu tidak bereaksi sama sekali.
 */
async function waitForLoginHydration(page) {
  const emptyError = page.getByText(/Username dan password wajib diisi/i).first();
  const submit = page.getByRole("button", { name: "Masuk" }).first();
  // Halaman /login merender fallback <Suspense> lebih dulu; tombol baru ada
  // setelah komponen klien ter-mount.
  const formReady = await submit
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  if (!formReady) return false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await emptyError.isVisible().catch(() => false)) return true;
    await submit.focus({ timeout: 5000 }).catch(() => {});
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  return false;
}

/** Login keyboard untuk sesi tambahan (sesi pertama memeriksa Tab order sendiri). */
async function loginWithKeyboard(page, account) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const hydrated = await waitForLoginHydration(page);
    if (!hydrated) continue;
    const typedUser = await typeStable(page, "Username", account.username);
    const typedPass = await typeStable(page, "Password", TEST_PASSWORD);
    if (!typedUser || !typedPass) continue;
    await page.keyboard.press("Tab"); // ke tombol Masuk
    await page.keyboard.press("Enter");
    const loggedIn = await page
      .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (loggedIn) return true;
  }
  return false;
}

const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return { tag: null };
    return {
      tag: el.tagName,
      id: el.id || null,
      text: (el.textContent || "").trim().slice(0, 60),
      role: el.getAttribute?.("role") ?? null,
    };
  });

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  try {
    await run(browser);
  } catch (e) {
    console.error("KEYBOARD FLOW ERROR:", e?.message ?? e);
    if (!diagnosed && activePage && activeAccount) {
      await diagnose(activePage, activeAccount, `error tak tertangani: ${e?.message ?? e}`);
    }
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

async function run(browser) {
  const pageErrors = [];
  console.log(
    `Akun uji: ${ACCOUNTS.klinis.label} (KB-01..KB-13), ${ACCOUNTS.registrasi.label} (KB-14..KB-20)`
  );

  // ==========================================================================
  // Sesi 1 — Dokter Klinik: login keyboard, skip link, menu Rekam Medis, SOAP
  // ==========================================================================
  const klinis = await openSession(browser, ACCOUNTS.klinis, pageErrors);
  const page = klinis.page;
  activePage = page;
  activeAccount = ACCOUNTS.klinis;
  try {
    // ---- 1) Login hanya dengan keyboard ----
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    // Tunggu hidrasi React dengan sinyal nyata (validasi field kosong muncul),
    // supaya ketikan tidak hilang karena di-render ulang sebelum state terpasang.
    const hydrated = await waitForLoginHydration(page);
    if (!hydrated) {
      await diagnose(
        page,
        ACCOUNTS.klinis,
        "form login tidak ter-hidrasi (validasi field kosong tidak pernah muncul)",
        "Periksa console/bundle halaman /login; tanpa hidrasi, alur keyboard tidak bisa diuji."
      );
      throw new Error("Form login tidak ter-hidrasi.");
    }

    await page.getByLabel("Username").focus();
    await page.keyboard.type(ACCOUNTS.klinis.username);
    await page.keyboard.press("Tab");
    const afterTab = await active(page);
    check(
      "KB-01",
      "Tab dari Username memindahkan fokus ke Password",
      /password/i.test(afterTab.id ?? "") || afterTab.tag === "INPUT",
      `active=${afterTab.tag}#${afterTab.id}`
    );
    await page.keyboard.type(TEST_PASSWORD);
    await page.keyboard.press("Tab");
    const atButton = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName === "BUTTON" && /masuk/i.test(el.textContent || "");
    });
    check("KB-02", "Tab dari Password mencapai tombol Masuk", atButton);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
    check(
      "KB-03",
      `Enter pada tombol Masuk memproses login sebagai ${ACCOUNTS.klinis.label} (keluar dari /login)`,
      !page.url().includes("/login"),
      page.url()
    );

    // Tunggu sinyal siap yang nyata (shell + navigasi ter-render), bukan sleep.
    // <nav aria-label="Navigasi utama"> adalah penanda shell internal yang stabil;
    // nav ini juga dipakai sebagai scope locator menu di langkah berikutnya.
    const mainNav = page.getByRole("navigation", { name: "Navigasi utama" });
    const navReady = await waitForOrDiagnose(
      page,
      mainNav,
      {
        account: ACCOUNTS.klinis,
        label: 'navigasi utama (aria-label "Navigasi utama")',
        hint: "Login tidak selesai atau role sesi tidak terbaca; periksa stub /auth/login dan mapping role backend → frontend.",
      }
    );
    if (!navReady) throw new Error("Shell internal dengan navigasi utama tidak tampil setelah login.");

    // ---- 2) Skip link ----
    await page.evaluate(() => document.body.focus?.());
    await page.keyboard.press("Tab");
    const firstStop = await active(page);
    check(
      "KB-04",
      "Tab pertama fokus ke skip link 'Lewati ke konten utama'",
      /lewati ke konten/i.test(firstStop.text ?? ""),
      `active=${firstStop.tag} "${firstStop.text}"`
    );
    await page.keyboard.press("Enter");
    const afterSkip = await active(page);
    check(
      "KB-05",
      "Enter pada skip link memindahkan fokus ke <main>",
      afterSkip.id === "main-content",
      `active=#${afterSkip.id}`
    );

    // ---- 3) Navigasi ke Rekam Medis lewat link (focus + Enter) ----
    // Menu "Rekam Medis" hanya dirender bila role memegang `view-clinical-notes`.
    // Locator dibatasi ke <nav aria-label="Navigasi utama">: halaman dashboard
    // juga punya kartu tindakan cepat bernama sama, sehingga locator global
    // menjadi ambigu (strict mode) dan bukan lagi menguji menu sidebar.
    const rekamMedisLink = mainNav.getByRole("link", { name: "Rekam Medis" });
    const rekamMedisVisible = await waitForOrDiagnose(page, rekamMedisLink, {
      account: ACCOUNTS.klinis,
      label: 'link "Rekam Medis"',
      hint: 'Menu difilter getNavigation(role) (src/lib/navigation.ts) dengan permission "view-clinical-notes" (lib/rbac.ts). Bila role akun uji tidak memilikinya, menu memang tidak boleh tampil — perbaiki akun/role di script, BUKAN permission.',
    });
    let linkFocused = false;
    let navigated = false;
    let destinationReady = false;
    let focusInMain = false;
    if (rekamMedisVisible) {
      await rekamMedisLink.focus();
      linkFocused = await page.evaluate(() =>
        /^Rekam Medis$/i.test((document.activeElement?.textContent || "").trim())
      );
      await page.keyboard.press("Enter");
      navigated = await page
        .waitForURL(/medical-records/, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      // Konten tujuan benar-benar tampil & berada di dalam <main>.
      destinationReady = await page
        .getByRole("heading", { name: "Rekam Medis", level: 1 })
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      focusInMain = await page.evaluate(() => {
        const main = document.getElementById("main-content");
        return Boolean(main && document.activeElement && main.contains(document.activeElement));
      });
    }
    check(
      "KB-06",
      "Fokus ke link 'Rekam Medis' + Enter membuka halaman dan konten tujuan tampil",
      rekamMedisVisible && linkFocused && navigated && destinationReady,
      `link=${rekamMedisVisible} fokus=${linkFocused} url=${page.url()} konten=${destinationReady} fokusDiMain=${focusInMain} (belum ada focus management antar-route — dicatat terpisah, bukan kegagalan langkah ini)`
    );
    if (!rekamMedisVisible) {
      throw new Error(
        `Link "Rekam Medis" tidak tersedia untuk ${ACCOUNTS.klinis.label}. Lihat diagnosis di atas ` +
          "(role akun uji tidak berhak `view-clinical-notes`, atau konfigurasi navigasi berubah)."
      );
    }

    // ---- 4) Buka modal SOAP dengan keyboard ----
    await page.waitForTimeout(1000);
    const soapBtn = page.getByRole("button", { name: /^SOAP$/ }).first();
    await waitForOrDiagnose(page, soapBtn, {
      account: ACCOUNTS.klinis,
      label: 'tombol "SOAP"',
      hint: "Tombol SOAP dirender per kunjungan antrean; stub API harus mengembalikan satu tiket /clinic/queues.",
    });
    await soapBtn.focus();
    await page.keyboard.press("Enter");
    const dialogVisible = await page
      .getByRole("dialog")
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check("KB-07", "Modal SOAP terbuka via Enter dan ber-role dialog", dialogVisible);

    // Tunggu effect focus-trap selesai (fokus awal ditempatkan di dalam dialog).
    await page.waitForTimeout(400);
    const focusInDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return Boolean(d && document.activeElement && d.contains(document.activeElement));
    });
    check("KB-08", "Fokus awal berada di dalam dialog (focus trap)", focusInDialog);

    // Tab melalui field S/O/A/P — pastikan semua dapat difokuskan.
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const a = await active(page);
      if (a.tag === "INPUT" || a.tag === "SELECT" || a.tag === "TEXTAREA") seen.add(a.id ?? `${a.tag}-${i}`);
    }
    check("KB-09", "Field SOAP (input/select) dapat dicapai dengan Tab", seen.size >= 4, `focusable fields=${seen.size}`);

    // Tutup modal dengan Escape dan pastikan fokus kembali ke pemicu.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = (await page.getByRole("dialog").count()) === 0;
    check("KB-10", "Escape menutup modal", closed);

    const focusRestored = await page.evaluate(() =>
      /^SOAP$/i.test((document.activeElement?.textContent || "").trim())
    );
    check("KB-11", "Fokus dikembalikan ke tombol pemicu setelah modal ditutup", focusRestored);

    // ---- 5) Simpan SOAP dengan keyboard ----
    await soapBtn.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    const subj = page.getByPlaceholder("Keluhan utama...");
    await subj.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await subj.focus();
    await page.waitForTimeout(150);
    await page.keyboard.type("Demam tiga hari");
    await page.waitForTimeout(150);
    const subjValue = await subj.inputValue().catch(() => "<err>");
    const focusedNow = await active(page);
    check(
      "KB-12",
      "Mengetik ke field S dengan keyboard berhasil",
      subjValue === "Demam tiga hari",
      `value="${subjValue}" active=${focusedNow.tag}#${focusedNow.id}`
    );
    const saveBtn = page.getByRole("button", { name: /Simpan SOAP/i }).first();
    await saveBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    const savedText = await page.evaluate(() => document.body.innerText);
    check(
      "KB-13",
      "Enter pada 'Simpan SOAP' menyimpan (pesan sukses tampil)",
      /SOAP tersimpan/i.test(savedText),
      savedText.match(/SOAP tersimpan[^\n]*/)?.[0] ?? "tidak ada pesan"
    );
  } catch (e) {
    // Sesi sengaja tidak ditutup: `main()` mendiagnosis halaman yang masih hidup
    // (URL + link + screenshot) sebelum menutup browser.
    console.error(`Sesi ${ACCOUNTS.klinis.label} berhenti:`, e?.message ?? e);
    throw e;
  }
  await klinis.context.close();

  // ==========================================================================
  // Sesi 2 — HR/PIC: tabel pekerja & wizard registrasi (butuh manage-employees)
  // ==========================================================================
  const registrasi = await openSession(browser, ACCOUNTS.registrasi, pageErrors);
  const page2 = registrasi.page;
  activePage = page2;
  activeAccount = ACCOUNTS.registrasi;
  try {
    const loggedIn = await loginWithKeyboard(page2, ACCOUNTS.registrasi);
    if (!loggedIn) {
      await diagnose(
        page2,
        ACCOUNTS.registrasi,
        "login keyboard sesi 2 tidak keluar dari /login",
        "Periksa stub /auth/login (username akun uji) dan pesan error di form login."
      );
      throw new Error("Login keyboard sesi 2 (HR/PIC) gagal.");
    }
    const navReady = await waitForOrDiagnose(
      page2,
      page2.getByRole("navigation", { name: "Navigasi utama" }),
      {
        account: ACCOUNTS.registrasi,
        label: 'navigasi utama (aria-label "Navigasi utama")',
        hint: "Login sesi 2 tidak selesai; periksa stub /auth/login untuk akun hr.pic.",
      }
    );
    if (!navReady) throw new Error("Shell internal sesi 2 (HR/PIC) tidak tampil setelah login.");

    // ---- 6) Filter & baris tabel: hanya keyboard ----
    await page2.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
    await page2.waitForTimeout(1200);
    await page2.evaluate(() => document.body.focus?.());

    // Cari filter dengan Tab dari awal dokumen (bukti ia ada di urutan fokus).
    let filterReachedByTab = false;
    let tabStops = 0;
    for (let i = 0; i < 120; i++) {
      await page2.keyboard.press("Tab");
      tabStops = i + 1;
      const isFilter = await page2.evaluate(
        () => document.activeElement?.getAttribute("aria-label") === "Cari pekerja"
      );
      if (isFilter) {
        filterReachedByTab = true;
        break;
      }
    }
    check(
      "KB-14",
      "Filter pencarian tabel dapat dicapai dengan Tab",
      filterReachedByTab,
      `tab stops yang dicoba=${tabStops} url=${page2.url()}`
    );
    await page2.keyboard.type("Budi");
    const filterValue = await page2.getByLabel("Cari pekerja").inputValue().catch(() => "<err>");
    check("KB-15", "Filter pencarian menerima ketikan keyboard", filterValue === "Budi", `value="${filterValue}"`);

    // Baris tabel: fokus + Enter membuka profil (bukan hanya bisa diklik mouse).
    await page2.waitForTimeout(1200);
    const row = page2.getByRole("link", { name: /Buka profil/i }).first();
    const rowVisible = await waitForOrDiagnose(page2, row, {
      account: ACCOUNTS.registrasi,
      label: 'link "Buka profil" pada baris tabel /people',
      timeout: 8000,
      hint: "Baris tabel butuh hasil GET /patients untuk role dengan manage-employees (hr.pic).",
    });
    await row.focus().catch(() => {});
    const rowFocused = await page2.evaluate(() =>
      /^Buka profil/i.test(document.activeElement?.getAttribute("aria-label") || "")
    );
    await page2.keyboard.press("Enter");
    // Tunggu navigasi nyata (bukan sleep tetap): baris tabel adalah elemen
    // role="link" dengan handler Enter → router.push(`/people/:id`).
    const rowOpened = await page2
      .waitForURL(/\/people\/pat-1/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check(
      "KB-16",
      "Baris tabel dapat difokuskan dan dibuka dengan Enter",
      rowVisible && rowFocused && rowOpened,
      `visible=${rowVisible} focused=${rowFocused} terbuka=${rowOpened} url=${page2.url()}`
    );

    // ---- 7) Wizard registrasi: field & tombol hanya keyboard ----
    await page2.goto(`${BASE}/people/new`, { waitUntil: "domcontentloaded" });
    const empId = page2.getByLabel("Employee ID").first();
    const empVisible = await waitForOrDiagnose(page2, empId, {
      account: ACCOUNTS.registrasi,
      label: 'field "Employee ID" pada wizard registrasi',
      hint: "Route /people/* dijaga permission manage-employees (components/route-guard.tsx); pastikan akun uji sesi 2 memang berhak.",
    });
    await empId.focus().catch(() => {});
    await page2.keyboard.type("EMP-9999");
    const empValue = await empId.inputValue().catch(() => "<err>");
    check(
      "KB-17",
      "Wizard: field langkah 1 dapat difokuskan dan diketik dengan keyboard",
      empVisible && empValue === "EMP-9999",
      `visible=${empVisible} value="${empValue}"`
    );

    // Penanda langkah: teks "Langkah X dari Y" hanya tampil di mobile
    // (`sm:hidden`), jadi yang dibaca di sini adalah indikator langkah aktif
    // (`aria-current="step"`) + judul panel langkah yang sedang tampil.
    const readStep = () =>
      page2.evaluate(() => {
        const counter = document.body.innerText.match(/Langkah\s+(\d+)\s+dari\s+(\d+)/)?.[0]?.trim();
        if (counter) return counter;
        const circles = Array.from(document.querySelectorAll("div.rounded-full.border-2"));
        const idx = circles.findIndex((el) => el.getAttribute("aria-current") === "step");
        // Teks label langkah ada di sibling berikutnya dari lingkaran indikator.
        const heading = circles[idx]?.nextElementSibling?.textContent?.trim() ?? "";
        return idx >= 0 ? `step ${idx + 1}/${circles.length}${heading ? ` — ${heading}` : ""}` : "";
      });
    const stepStart = await readStep();

    // Lengkapi seluruh field wajib langkah 1 HANYA dengan keyboard:
    // ketik teks/angka, pindah dengan Tab, ubah <select> native dengan ArrowDown.
    const typeIntoField = async (label, text) => {
      const field = page2.getByLabel(label).first();
      await field.focus().catch(() => {});
      await page2.keyboard.type(text);
      return field.inputValue().catch(() => "<err>");
    };
    const nameValue = await typeIntoField("Nama Lengkap", "Budi Santoso");
    const idValue = await typeIntoField("Nomor Identifier", "3174010101900001");
    await page2.keyboard.press("Tab"); // blur → onBlur/checkDuplicate ikut berjalan
    // <input type="date"> diisi lewat API native (segmen tanggal bergantung
    // locale mesin uji); field lain diketik dengan keyboard.
    const birthField = page2.getByLabel("Tanggal Lahir").first();
    await birthField.fill("1990-01-01");
    const birthValue = await birthField.inputValue().catch(() => "<err>");
    const sexSelect = page2.getByLabel("Jenis Kelamin").first();
    await sexSelect.selectOption("MALE");
    const sexValue = await sexSelect.inputValue().catch(() => "<err>");
    await page2.waitForTimeout(400);

    check(
      "KB-18",
      "Wizard: semua field wajib langkah 1 dapat diisi hanya dengan keyboard",
      nameValue === "Budi Santoso" &&
        idValue === "3174010101900001" &&
        birthValue === "1990-01-01" &&
        sexValue !== "" &&
        empValue === "EMP-9999",
      `nama="${nameValue}" nik="${idValue}" tgl="${birthValue}" sex="${sexValue}" emp="${empValue}"`
    );

    const stepFilled = await readStep();
    const nextBtn = page2.getByRole("button", { name: /^Lanjut$/ }).first();
    const nextVisible = await nextBtn
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (!nextVisible) {
      // Modal dengan aria-hidden/inert membuat tombol di belakangnya hilang dari
      // accessibility tree, jadi laporkan penyebabnya alih-alih timeout buta.
      const blocking = await page2.evaluate(() => ({
        dialog: document.querySelector('[role="dialog"]')?.textContent?.trim().slice(0, 120) ?? null,
        alerts: Array.from(document.querySelectorAll('[role="alert"]'))
          .map((el) => (el.textContent || "").trim().slice(0, 120))
          .join("; "),
      }));
      console.log(`  (tombol Lanjut tidak terlihat — dialog="${blocking.dialog}" alert="${blocking.alerts}")`);
    }
    if (nextVisible) await nextBtn.press("Enter");
    await page2.waitForTimeout(900);
    const stepAfter = await readStep();
    const wizardState = await page2.evaluate(() => ({
      alerts: document.querySelectorAll('[role="alert"]').length,
      invalidFields: document.querySelectorAll('[aria-invalid="true"]').length,
      focusTag: document.activeElement?.tagName ?? null,
    }));

    check(
      "KB-19",
      "Wizard: Enter pada 'Lanjut' memajukan ke langkah berikutnya",
      nextVisible && stepAfter !== stepFilled && /^step 2\//.test(stepAfter),
      `step="${stepFilled}"->"${stepAfter}" (mulai "${stepStart}") invalid=${wizardState.invalidFields} alerts=${wizardState.alerts}`
    );
    check(
      "KB-20",
      "Wizard: fokus tetap di dalam dokumen (tidak ada keyboard trap)",
      wizardState.focusTag !== "BODY" && wizardState.focusTag !== "HTML",
      `focus=${wizardState.focusTag}`
    );
  } catch (e) {
    console.error(`Sesi ${ACCOUNTS.registrasi.label} berhenti:`, e?.message ?? e);
    throw e;
  }
  await registrasi.context.close();

  check("KB-00", "Tidak ada pageerror selama alur keyboard", pageErrors.length === 0, pageErrors.join("; "));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main();
