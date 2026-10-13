/**
 * Helper bersama untuk seluruh skrip E2E browser (F1-A).
 *
 * Tujuan:
 *  - Resolusi `playwright-core` yang deterministik: pakai dependency frontend
 *    bila ada, lalu fallback ke workspace backend yang di-vendor (didokumentasikan).
 *  - Konfigurasi executable Chrome eksplisit (channel `chrome`), dengan opsi
 *    `E2E_CHROME_PATH` untuk CI tanpa Chrome channel.
 *  - Pelaporan hasil yang tidak pernah "fake green": FAIL memaksa exit code != 0.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * Mencari modul playwright-core.
 * Urutan: node_modules frontend → workspace bersaudara (mis. repo backend).
 * Jika tidak ditemukan, error menyebutkan cara memperbaikinya.
 */
export function loadPlaywright() {
  const candidates = [];
  try {
    candidates.push(require.resolve("playwright-core"));
  } catch {
    /* belum terpasang di repo frontend */
  }
  const root = process.cwd();
  if (fs.existsSync(root)) {
    for (const dir of fs.readdirSync(root)) {
      if (dir === "node_modules" || dir.startsWith(".")) continue;
      const candidate = path.resolve(root, dir, "node_modules", "playwright-core");
      if (fs.existsSync(candidate)) candidates.push(candidate);
    }
  }
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      /* coba kandidat berikutnya */
    }
  }
  throw new Error(
    "playwright-core tidak ditemukan. Jalankan `npm install --save-dev --legacy-peer-deps playwright-core` " +
      "di repo frontend, atau sediakan playwright-core pada workspace bersaudara."
  );
}

/** Nama kandidat channel/executable yang akan dicoba berurutan. */
export function chromeConfig() {
  const explicit = process.env.E2E_CHROME_PATH;
  const channels = [
    ...(explicit ? [{ channel: undefined, executablePath: explicit }] : []),
    { channel: "chrome" },
    { channel: "chrome-beta" },
    { channel: undefined },
  ];
  return channels;
}

/** Meluncurkan Chrome headless; melempar error yang menjelaskan bila gagal. */
export async function launchBrowser(playwright, options = {}) {
  const headless = options.headless !== false;
  const attempts = [];
  for (const candidate of chromeConfig()) {
    try {
      const browser = await playwright.chromium.launch({ headless, ...candidate });
      return { browser, launch: candidate };
    } catch (e) {
      attempts.push(`${JSON.stringify(candidate)}: ${String(e?.message || e).split("\n")[0]}`);
    }
  }
  throw new Error(
    "Tidak dapat meluncurkan browser. Percobaan:\n" +
      attempts.map((a) => `  - ${a}`).join("\n") +
      "\nSediakan Chrome (channel chrome) atau set E2E_CHROME_PATH ke executable Chrome/Chromium."
  );
}

export function isStagingUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.protocol === "https:" && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(u.hostname);
  } catch {
    return false;
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Kolektor hasil.
 *
 * Setiap hasil punya kategori supaya laporan dapat membedakan:
 *  - test bug frontend
 *  - blocker environment/backend (TIDAK dihitung PASS)
 *  - negative case yang memang diharapkan
 */
export function createReporter({ outDir, meta = {} }) {
  const results = [];
  const pageErrors = [];
  const consoleErrors = [];
  const requests = [];

  function record(id, group, name, status, detail = "", extra = {}) {
    const entry = { id, group, name, status, detail, ...extra };
    results.push(entry);
    const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : status === "BLOCKED" ? "▲" : "•";
    console.log(`${icon} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
    return entry;
  }

  function trackPage(page, label) {
    // Request log per page (dipakai untuk membuktikan "tidak ada request saat load")
    page.on("request", (req) => {
      requests.push({ label, method: req.method(), url: req.url(), at: Date.now() });
    });
    page.on("pageerror", (err) => {
      pageErrors.push(`${label}: ${err.message}`);
    });
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      // Error console yang diharapkan pada negative case (4xx yang memang diuji)
      if (/Failed to load resource|status of 4\d\d|status of 5\d\d/.test(text)) return;
      consoleErrors.push(`${label}: ${text}`);
    });
    return page;
  }

  function requestsMatching(regex, method) {
    return requests.filter(
      (r) => (!method || r.method === method) && regex.test(r.url)
    );
  }

  async function shot(page, name) {
    ensureDir(outDir);
    const file = path.join(outDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => {});
    return file;
  }

  return {
    results,
    pageErrors,
    consoleErrors,
    requests,
    record,
    trackPage,
    requestsMatching,
    shot,
    meta,
    write() {
      ensureDir(outDir);
      const summary = {
        generatedAt: new Date().toISOString(),
        ...meta,
        totals: {
          total: results.length,
          passed: results.filter((r) => r.status === "PASS").length,
          failed: results.filter((r) => r.status === "FAIL").length,
          blocked: results.filter((r) => r.status === "BLOCKED").length,
          skipped: results.filter((r) => r.status === "SKIP").length,
        },
        pageErrors,
        unexpectedConsoleErrors: consoleErrors,
        requests: requests.length,
        results,
      };
      const file = path.join(outDir, meta.reportName ?? "browser-e2e-report.json");
      fs.writeFileSync(file, JSON.stringify(summary, null, 2));
      return { file, summary };
    },
  };
}
