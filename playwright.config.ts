import { defineConfig, devices } from "@playwright/test";

/**
 * E2E browser (Playwright) untuk alur MUTASI frontend.
 *
 * Prinsip:
 *  - Tidak pernah Against produksi. Server yang dijalankan Playwright adalah
 *    build lokal dengan `NEXT_PUBLIC_API_URL` menunjuk ke origin yang sama,
 *    sehingga seluruh request API dilayani mock di dalam browser.
 *  - Tidak ada sleep/timeout tetap: assertion Playwright menunggu otomatis.
 *  - Worker tunggal supaya hasil deterministik dan tidak saling berebut port.
 */
const PORT = Number(process.env.E2E_PORT ?? 3111);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

const chromePath = process.env.E2E_CHROME_PATH;

export default defineConfig({
  testDir: "./e2e/playwright",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-artifacts/playwright-report", open: "never" }],
    ["json", { outputFile: "test-artifacts/playwright-report.json" }],
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
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // API base URL = origin yang sama; seluruh request /api/v1/** di-intercept
      // oleh mock di dalam browser (tidak pernah menyentuh backend nyata).
      NEXT_PUBLIC_API_URL: `${BASE_URL}/api/v1`,
      NEXT_PUBLIC_ENABLE_DEMO: "false",
      NEXT_PUBLIC_APP_VERSION: "a1-e2e",
    },
  },
});
