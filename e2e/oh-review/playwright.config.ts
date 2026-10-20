import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * E2E browser (Playwright) untuk Fase A3 — Review MCU, Resume/Sertifikat, D&A.
 *
 * Berdiri sendiri (tidak mengubah konfigurasi Playwright milik fase lain):
 *  - testDir  : folder A3 (`e2e/oh-review/**` dan `e2e/dna/**`).
 *  - webServer: build produksi lokal dengan feature flag A3 AKTIF, API base URL
 *               menunjuk ke origin yang sama sehingga seluruh request API
 *               dilayani mock di dalam browser (tidak pernah menyentuh backend
 *               nyata / produksi).
 *  - Tidak ada sleep/timeout tetap: assertion Playwright menunggu otomatis.
 */
const PORT = Number(process.env.E2E_A3_PORT ?? 3121);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const ROOT = path.resolve(__dirname, "..", "..");

const chromePath = process.env.E2E_CHROME_PATH;

export default defineConfig({
  testDir: path.resolve(ROOT, "e2e"),
  testMatch: /.*\.spec\.ts$/,
  testIgnore: "**/playwright/**",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-artifacts/a3-playwright-report.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    launchOptions: chromePath ? { executablePath: chromePath } : { channel: "chrome" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: undefined },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    cwd: ROOT,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_API_URL: `${BASE_URL}/api/v1`,
      NEXT_PUBLIC_ENABLE_DEMO: "false",
      NEXT_PUBLIC_APP_VERSION: "a3-e2e",
      NEXT_PUBLIC_FEATURE_OH_REVIEW: "1",
      NEXT_PUBLIC_FEATURE_DNA: "1",
    },
  },
});
