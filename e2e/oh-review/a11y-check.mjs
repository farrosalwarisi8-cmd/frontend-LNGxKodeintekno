#!/usr/bin/env node
/**
 * Audit aksesibilitas (axe-core) untuk halaman baru Fase A3.
 *
 * Berdiri sendiri (tidak mengubah `scripts/a11y-audit.mjs` milik fase lain):
 * memakai sesi Dokter OH (role yang boleh membuka /oh-review & /dna), mock API
 * di dalam browser, dan route A3 saja.
 *
 * Env:
 *   A11Y_BASE_URL   default http://localhost:3123
 *   A11Y_OUT_DIR    default test-artifacts/a3-a11y
 *
 * Gagal (exit 1) bila ada pelanggaran impact `critical`/`serious` atau ada
 * kontrol form tanpa nama aksesibel.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ensureDir, launchBrowser, loadPlaywright } from "../lib/browser.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.env.A11Y_BASE_URL ?? "http://localhost:3123").replace(/\/+$/, "");
const OUT = process.env.A11Y_OUT_DIR ?? path.join("test-artifacts", "a3-a11y");

const axeSource = fs.readFileSync(
  path.join(path.dirname(require.resolve("axe-core/package.json")), "axe.min.js"),
  "utf8"
);

const ROUTES = ["/oh-review", "/oh-review/restrictions", "/dna"];

const SEED_USER = {
  id: "u-a3-a11y",
  username: "dokter.oh",
  name: "Dokter OH",
  password: "",
  role: "dokter-oh",
  title: "Dokter Spesialis Okupasi",
  mfaEnabled: false,
  preferredLanguage: "id",
};

function envelope(data, meta) {
  return JSON.stringify({
    success: true,
    statusCode: 200,
    message: "ok",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  });
}

const MCU_CYCLE = {
  id: "mcu-cycle-1",
  patient_id: "patient-1",
  mcu_type: "ANNUAL_PERIODIC",
  examination_date: "2026-10-01",
  status: "COMPLETED",
  patient: {
    id: "patient-1",
    medical_record_no: "MRN-A11Y-0001",
    full_name: "Budi Santoso",
    employee: {
      employee_no: "EMP-A11Y-001",
      full_name: "Budi Santoso",
      site: { id: "site-1", code: "SITE-A", name: "Site A" },
    },
  },
  calculations: [
    { name: "bmi", value: 24.5, unit: "kg/m2" },
    { name: "audiometry", value: 30, unit: "dB", worsening: true },
  ],
  ftw_assessment: {
    id: "assessment-1",
    ftw_status: "FIT_WITH_RESTRICTION",
    summary: "Laik bekerja dengan pembatasan.",
    assessed_at: "2026-10-02T08:00:00.000Z",
    restrictions: [
      {
        id: "restriction-1",
        description: "Dilarang bekerja di ketinggian lebih dari 2 meter",
        effective_date: "2026-10-02",
        review_date: "2027-01-04",
        status: "ACTIVE",
      },
    ],
  },
};

const DA_TEST = {
  id: "da-test-1",
  patient_id: "patient-1",
  test_type: "RANDOM_INSPECTION",
  status: "CONFIRMATION_PENDING",
  created_at: "2026-10-01T07:00:00.000Z",
  patient: { id: "patient-1", medical_record_no: "MRN-A11Y-0001", full_name: "Budi Santoso" },
  samples: [
    {
      id: "sample-1",
      da_test_id: "da-test-1",
      sample_no: "SMP-A11Y-0001",
      specimen_type: "URINE",
      custody_chain: [
        {
          id: "custody-1",
          from_party: "Officer A11Y",
          to_party: "Laboratorium A11Y",
          action: "SAMPLE_COLLECTED_AND_SEALED",
          signature_hash: "hash-a11y",
          event_at: "2026-10-01T07:10:00.000Z",
        },
      ],
    },
  ],
  results: [
    {
      id: "da-result-1",
      da_test_id: "da-test-1",
      screening_result: "NON_NEGATIVE",
      confirmation_result: null,
      confirmed: false,
    },
  ],
};

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  ensureDir(OUT);
  let violations = 0;
  let unlabeled = 0;

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(
      ([user]) => {
        localStorage.setItem(
          "kodein-klinik-store",
          JSON.stringify({ state: { currentUserId: user.id, users: [user] }, version: 0 })
        );
        localStorage.setItem(
          "emr-demo-role",
          JSON.stringify({ state: { role: "SYSTEM_ADMIN", enabled: false }, version: 0 })
        );
      },
      [SEED_USER]
    );
    await context.addCookies([
      {
        name: "kodein-klinik-store",
        value: encodeURIComponent(JSON.stringify({ state: { currentUserId: SEED_USER.id } })),
        url: BASE,
      },
    ]);

    const page = await context.newPage();
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const apiPath = url.pathname.replace(/^\/api\/v1/, "") || "/";
      if (request.method() === "GET" && apiPath === "/mcu/cycles") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: envelope([MCU_CYCLE], { page: 1, limit: 100, total: 1, totalPages: 1 }),
        });
      }
      if (request.method() === "GET" && apiPath === "/da/tests") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: envelope({ data: [DA_TEST], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: envelope([]),
      });
    });

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        const fields = Array.from(
          document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([aria-hidden="true"]), select:not([aria-hidden="true"]), textarea:not([aria-hidden="true"])'
          )
        );
        const missing = [];
        for (const el of fields) {
          let name = (el.getAttribute("aria-label") || "").trim();
          if (!name && el.id) {
            const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            name = (explicit?.textContent || "").trim();
          }
          if (!name) name = (el.closest("label")?.textContent || "").trim();
          if (!name) name = (el.getAttribute("title") || "").trim();
          if (!name) missing.push(el.outerHTML.slice(0, 120));
        }
        return {
          violations: r.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            sample: v.nodes.slice(0, 3).map((n) => (n.target || []).join(" ")).join(" | "),
          })),
          unlabeled: missing,
        };
      });

      const serious = result.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      violations += serious.length;
      unlabeled += result.unlabeled.length;
      console.log(
        `${serious.length === 0 && result.unlabeled.length === 0 ? "PASS" : "FAIL"} axe ${route} ` +
          `(violations: ${result.violations.length}, critical/serious: ${serious.length}, unlabeled: ${result.unlabeled.length})`
      );
      for (const v of result.violations) {
        console.log(`   - ${v.impact} ${v.id}: ${v.help} (${v.nodes} node) ${v.sample}`);
      }
      for (const html of result.unlabeled) {
        console.log(`   - unlabeled control: ${html}`);
      }
      fs.writeFileSync(
        path.join(OUT, `a11y${route.replace(/\//g, "-")}.json`),
        JSON.stringify({ route, ...result }, null, 2)
      );
    }
  } finally {
    await browser.close();
  }

  if (violations > 0 || unlabeled > 0) {
    console.log(`FAIL total: ${violations} critical/serious, ${unlabeled} unlabeled`);
    process.exit(1);
  }
  console.log("PASS tidak ada pelanggaran critical/serious dan semua kontrol berlabel");
}

await main();
