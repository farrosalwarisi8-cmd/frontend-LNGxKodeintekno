/**
 * Cek A3 — feature flag MATI.
 *
 * Membuktikan bahwa dengan flag dimatikan (default) perilaku aplikasi lama
 * tidak berubah:
 *  - route /oh-review & /dna menampilkan status "fitur belum aktif";
 *  - item menu A3 TIDAK tampil di sidebar;
 *  - halaman lama (/mcu/review) tetap seperti sebelumnya;
 *  - role tanpa izin tetap ditolak (AccessDenied).
 *
 * Sesi di-seed langsung di localStorage + cookie (tanpa backend, tanpa
 * password nyata), dan seluruh request API di-mock di dalam browser.
 *
 * Cara menjalankan (butuh build dengan flag mati):
 *   npx next build && npx next start -p 3122
 *   E2E_BASE_URL=http://localhost:3122 node e2e/oh-review/flag-off-check.mjs
 */
import { loadPlaywright, launchBrowser } from "../lib/browser.mjs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3122";
const pw = loadPlaywright();
const { browser } = await launchBrowser(pw, { headless: true });
let fail = 0;
const check = (ok, name, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  if (!ok) fail++;
};

async function openSession(role, label) {
  const user = {
    id: `u-a3-${role}`,
    username: `demo.${role}`,
    name: `Tester ${role}`,
    password: "",
    role,
    title: role,
    employeeId: "pat-a3",
    mfaEnabled: false,
    preferredLanguage: "id",
  };
  const context = await browser.newContext();
  await context.addInitScript(
    ([seeded]) => {
      localStorage.setItem(
        "kodein-klinik-store",
        JSON.stringify({ state: { currentUserId: seeded.id, users: [seeded] }, version: 0 })
      );
      localStorage.setItem(
        "emr-demo-role",
        JSON.stringify({ state: { role: "SYSTEM_ADMIN", enabled: false }, version: 0 })
      );
    },
    [user]
  );
  await context.addCookies([
    {
      name: "kodein-klinik-store",
      value: encodeURIComponent(JSON.stringify({ state: { currentUserId: user.id } })),
      url: BASE,
    },
  ]);
  await context.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        statusCode: 200,
        message: "ok",
        data: [],
        timestamp: new Date().toISOString(),
      }),
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  pageerror ${label}: ${e.message}`));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Navigasi utama" }).waitFor({ timeout: 20000 });
  return { context, page };
}

try {
  // 1. Route A3 menampilkan status fitur belum aktif.
  let s = await openSession("dokter-oh", "dokter-oh");
  await s.page.goto(`${BASE}/oh-review`, { waitUntil: "domcontentloaded" });
  await s.page.getByText("Fitur Review MCU belum aktif").waitFor({ timeout: 20000 });
  check(true, "/oh-review menampilkan status nonaktif saat flag mati");

  await s.page.goto(`${BASE}/dna`, { waitUntil: "domcontentloaded" });
  await s.page.getByText("Fitur D&A belum aktif").waitFor({ timeout: 20000 });
  check(true, "/dna menampilkan status nonaktif saat flag mati");

  // 2. Menu A3 tidak tampil.
  await s.page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await s.page.getByRole("link", { name: "Dashboard" }).first().waitFor({ timeout: 20000 });
  const ohLinks = await s.page.getByRole("link", { name: "Review MCU Dokter OH" }).count();
  const restLinks = await s.page.getByRole("link", { name: "Restriksi Kerja (OH)" }).count();
  const dnaLinks = await s.page.getByRole("link", { name: "D&A Forensik (OH)" }).count();
  check(ohLinks === 0, "menu Review MCU Dokter OH tidak tampil", `count=${ohLinks}`);
  check(restLinks === 0, "menu Restriksi Kerja (OH) tidak tampil", `count=${restLinks}`);
  check(dnaLinks === 0, "menu D&A Forensik (OH) tidak tampil", `count=${dnaLinks}`);

  // 3. Halaman lama tetap bisa diakses (perilaku tidak berubah).
  await s.page.goto(`${BASE}/mcu/review`, { waitUntil: "domcontentloaded" });
  await s.page.getByRole("heading", { name: "Review MCU" }).first().waitFor({ timeout: 20000 });
  check(true, "/mcu/review (halaman lama) tetap tampil");
  await s.context.close();

  // 4. Role tanpa izin tetap ditolak di route A3.
  s = await openSession("hr", "hr");
  await s.page.goto(`${BASE}/oh-review`, { waitUntil: "domcontentloaded" });
  await s.page.getByRole("heading", { name: "Akses Ditolak" }).waitFor({ timeout: 20000 });
  check(true, "HR tetap ditolak di /oh-review (AccessDenied)");
  await s.context.close();
} catch (e) {
  console.log("FAIL exception:", String(e).split("\n")[0]);
  fail++;
} finally {
  await browser.close();
}

process.exit(fail ? 1 : 0);
