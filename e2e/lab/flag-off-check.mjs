import { loadPlaywright, launchBrowser } from "../lib/browser.mjs";
import { openA2Session } from "../lib/a2-fixtures.mjs";

const BASE = "http://localhost:3313";
const pw = loadPlaywright();
const { browser } = await launchBrowser(pw, { headless: true });
let fail = 0;
const check = (ok, name, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`); if (!ok) fail++; };

try {
  // 1. /radiology saat flag mati → status nonaktif (bukan form)
  let s = await openA2Session(browser, { base: BASE, role: "lab", label: "flagoff" });
  await s.page.goto(`${BASE}/radiology`, { waitUntil: "domcontentloaded" });
  await s.page.getByText("Fitur Radiologi belum aktif").waitFor({ timeout: 20000 });
  check(true, "/radiology menampilkan status nonaktif saat flag mati");
  await s.context.close();

  // 2. menu Radiologi tidak tampil, menu Lab tetap mengarah ke /lab
  s = await openA2Session(browser, { base: BASE, role: "lab", label: "flagoff-nav" });
  await s.page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await s.page.getByRole("link", { name: "Lab & Radiologi" }).first().waitFor({ timeout: 20000 });
  const radLinks = await s.page.getByRole("link", { name: "Radiologi", exact: true }).count();
  const labLinks = await s.page.getByRole("link", { name: "Lab & Radiologi", exact: true }).count();
  check(radLinks === 0, "menu Radiologi tidak tampil saat flag mati", `count=${radLinks}`);
  check(labLinks > 0, "menu Lab & Radiologi tetap tampil", `count=${labLinks}`);
  await s.context.close();

  // 3. /lab memakai halaman legacy (perilaku main) — bukan workspace baru
  s = await openA2Session(browser, { base: BASE, role: "lab", label: "flagoff-lab" });
  await s.page.goto(`${BASE}/lab`, { waitUntil: "domcontentloaded" });
  await s.page.waitForTimeout(3000);
  const text = await s.page.evaluate(() => document.body.innerText);
  const isNewWorkspace = /3 order ditemukan|Cari order lab/.test(text);
  check(!isNewWorkspace, "/lab memakai halaman lama (legacy) saat flag mati");
  await s.context.close();
} catch (e) {
  console.log("FAIL exception:", String(e).split("\n")[0]);
  fail++;
} finally {
  await browser.close();
}
process.exit(fail ? 1 : 0);
