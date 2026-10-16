#!/usr/bin/env node
/**
 * Audit aksesibilitas otomatis (axe-core) untuk target WCAG AA.
 *
 * Menjalankan Chrome headless terhadap dev/prod server, menyuntikkan sesi
 * internal + menstub API backend (tanpa backend hidup), lalu menjalankan axe
 * pada setiap route — termasuk dua modal yang bisa dibuka tanpa data.
 * Gagal (exit 1) bila ada pelanggaran impact `critical`/`serious`.
 *
 * Env:
 *   A11Y_BASE_URL   default http://localhost:3311
 *   A11Y_ROUTES     comma-separated override daftar route
 *   A11Y_OUT_DIR    default test-artifacts/a11y
 *   A11Y_IMPACTS    default "critical,serious"
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ensureDir, launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const require = createRequire(import.meta.url);
const BASE = (process.env.A11Y_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");
const OUT = process.env.A11Y_OUT_DIR ?? path.join("test-artifacts", "a11y");
const FAIL_IMPACTS = (process.env.A11Y_IMPACTS ?? "critical,serious")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const axeSource = fs.readFileSync(
  path.join(path.dirname(require.resolve("axe-core/package.json")), "axe.min.js"),
  "utf8"
);

const DEFAULT_ROUTES = [
  "/login",
  "/dashboard",
  "/people",
  "/employees",
  "/mcu",
  "/mcu/new",
  "/mcu/review",
  "/visits",
  "/visits/new",
  "/visits/queue",
  "/medical-records",
  "/medicine",
  "/medicine/dispense",
  "/medicine/return",
  "/certificates",
  "/reports",
  "/health-status",
  "/waiver",
  "/da",
  "/emergency",
  "/users",
  "/master-data",
  "/audit-logs",
  "/lab",
  "/signatures",
  "/documents",
  "/my",
  "/my/profile",
  "/my/mcu",
  "/my/certificates",
  "/my/notifications",
  "/demo",
];

// Modal yang bisa dibuka tanpa data — ikut diaudit setelah halamannya.
const OPEN_DIALOG = {
  "/emergency": /Catatan Darurat/i,
  "/medicine": /Terima Stok/i,
};

const ROUTES = (process.env.A11Y_ROUTES ? process.env.A11Y_ROUTES.split(",") : DEFAULT_ROUTES)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((r) => (r.startsWith("/") ? r : `/${r}`));

const SEED_USER = {
  id: "u-a11y",
  username: "admin.a11y",
  name: "Admin A11y",
  password: "",
  role: "admin",
  title: "System Administrator",
  mfaEnabled: false,
  preferredLanguage: "id",
};

const EMPTY_ENVELOPE = JSON.stringify({
  success: true,
  statusCode: 200,
  data: [],
  meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
  timestamp: new Date().toISOString(),
});

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  try {
    await run();
  } finally {
    await browser.close();
  }

  async function run() {
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
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: EMPTY_ENVELOPE })
    );

    const results = [];
    const allViolations = [];
    const allBestPractice = [];
    const allSmallTargets = [];
    const allUnlabeled = [];

    // Menyuntikkan axe + menjalankan pada dokumen saat ini; bentuk ringkas
    // dikembalikan dari page agar serialisasi CDP tidak berat.
    async function auditCurrent() {
      await page.addScriptTag({ content: axeSource });
      return page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        // Best-practice dipisah: informatif saja, bukan gate.
        const bp = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["best-practice"] },
        });
        const fold = (v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          sample: v.nodes.slice(0, 4).map((n) => (n.target || []).join(" ")).join(" | "),
          htmls: v.nodes.slice(0, 3).map((n) => String(n.html).replace(/\s+/g, " ").slice(0, 180)),
        });
        const vios = r.violations.map(fold);
        const bpVios = bp.violations.map(fold);

        // Kriteria "semua input berlabel": setiap field harus punya nama
        // aksesibel (label terlihat, label tersembunyi, aria-label, atau title).
        // `aria-hidden="true"` dihapus dari pohon aksesibilitas, jadi kontrol
        // tersembunyi milik primitif (mis. hidden input Base UI Select) tidak
        // perlu nama aksesibel dan tidak boleh dihitung sebagai field.
        const fields = Array.from(
          document.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([aria-hidden="true"]), select:not([aria-hidden="true"]), textarea:not([aria-hidden="true"])'
          )
        );
        const unlabeled = [];
        for (const el of fields) {
          let name = (el.getAttribute("aria-label") || "").trim();
          if (!name) {
            const ids = (el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
            name = ids.map((i) => (document.getElementById(i)?.textContent || "").trim()).join(" ").trim();
          }
          if (!name && el.id) {
            const explicit = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            name = (explicit?.textContent || "").trim();
          }
          if (!name) name = (el.closest("label")?.textContent || "").trim();
          if (!name) name = (el.getAttribute("title") || "").trim();
          if (!name) {
            unlabeled.push({
              tag: el.tagName,
              type: el.getAttribute("type"),
              id: el.id || null,
              name: el.getAttribute("name"),
              placeholder: el.getAttribute("placeholder"),
            });
          }
        }
        const els = Array.from(
          document.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select, textarea, a[href]')
        );
        const small = els
          .map((el) => {
            const style = getComputedStyle(el);
            if (el.tagName === "A" && style.display === "inline") return null;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return null;
            if (rect.height < 44 || rect.width < 44) {
              const label = (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40);
              return { tag: el.tagName, label, w: Math.round(rect.width), h: Math.round(rect.height) };
            }
            return null;
          })
          .filter(Boolean);
        return { violations: vios, bestPractice: bpVios, smallTargets: small, fields: fields.length, unlabeled };
      });
    }

    function record(label, { violations, bestPractice, smallTargets, fields, unlabeled }) {
      for (const v of violations) allViolations.push({ route: label, ...v });
      for (const v of bestPractice) allBestPractice.push({ route: label, ...v });
      for (const t of smallTargets) allSmallTargets.push({ route: label, ...t });
      for (const f of unlabeled) allUnlabeled.push({ route: label, ...f });
      results.push({
        route: label,
        seriousOrCritical: violations.filter((v) => FAIL_IMPACTS.includes(v.impact ?? "")).length,
        all: violations.length,
        smallTargets: smallTargets.length,
        fields,
        unlabeled: unlabeled.length,
      });
    }

    for (const route of ROUTES) {
      console.log(`[a11y] auditing ${route} ...`);
      await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(700);
      record(route, await auditCurrent());

      const trigger = OPEN_DIALOG[route];
      if (trigger) {
        const opened = await page
          .getByRole("button", { name: trigger })
          .first()
          .click({ timeout: 4000 })
          .then(() => true)
          .catch(() => false);
        if (opened) {
          await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(300);
          record(`${route} (modal)`, await auditCurrent());
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        }
      }
    }

    ensureDir(OUT);
    const failing = allViolations.filter((v) => FAIL_IMPACTS.includes(v.impact ?? ""));
    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      failImpacts: FAIL_IMPACTS,
      routes: results,
      totals: {
        routes: ROUTES.length,
        violations: allViolations.length,
        failing: failing.length,
        smallTouchTargets: allSmallTargets.length,
        formFields: results.reduce((n, r) => n + r.fields, 0),
        unlabeledFields: allUnlabeled.length,
        bestPracticeViolations: allBestPractice.length,
      },
      byRule: Object.values(
        allViolations.reduce((acc, v) => {
          const key = `${v.id}:${v.impact}`;
          acc[key] ??= { id: v.id, impact: v.impact, help: v.help, count: 0, routes: new Set() };
          acc[key].count += v.nodes;
          acc[key].routes.add(v.route);
          return acc;
        }, {})
      ).map((r) => ({ id: r.id, impact: r.impact, help: r.help, count: r.count, routes: [...r.routes] })),
      failingViolations: failing,
      unlabeledFields: allUnlabeled,
      bestPractice: allBestPractice,
      touchTargets: allSmallTargets,
    };
    const file = path.join(OUT, "report.json");
    fs.writeFileSync(file, JSON.stringify(report, null, 2));

    console.log(`\nAxe audit — ${results.length} halaman/state`);
    for (const r of results) {
      if (r.all > 0) {
        console.log(
          `  ${r.seriousOrCritical > 0 ? "✗" : "•"} ${r.route}: ${r.all} violation (${r.seriousOrCritical} critical/serious)`
        );
      }
    }
    console.log("\nPeraturan yang dilanggar (semua impact):");
    for (const r of report.byRule.sort((a, b) => b.count - a.count)) {
      console.log(`  [${r.impact}] ${r.id} — ${r.help} (nodes=${r.count}, routes=${r.routes.length})`);
    }
    console.log(
      `\nTotal: ${allViolations.length} violation; ${failing.length} impact ${FAIL_IMPACTS.join("/")}. Report: ${file}`
    );

    const totalFields = results.reduce((n, r) => n + r.fields, 0);
    console.log(
      `Field form: ${totalFields} input/select/textarea diperiksa — ${allUnlabeled.length} tanpa nama aksesibel`
    );
    for (const r of results) {
      if (r.unlabeled > 0) console.log(`  ✗ ${r.route}: ${r.unlabeled} field tanpa label`);
    }
    if (allBestPractice.length > 0) {
      const bpByRule = Object.values(
        allBestPractice.reduce((acc, v) => {
          acc[v.id] ??= { id: v.id, impact: v.impact, help: v.help, count: 0 };
          acc[v.id].count += v.nodes;
          return acc;
        }, {})
      );
      console.log(`Best-practice (info, bukan gate): ${allBestPractice.length}`);
      for (const r of bpByRule.sort((a, b) => b.count - a.count)) {
        console.log(`  • ${r.id} — ${r.help} (nodes=${r.count})`);
      }
    } else {
      console.log("Best-practice (info): 0");
    }
    const smallByTag = allSmallTargets.reduce((acc, t) => {
      acc[t.tag] = (acc[t.tag] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `Target sentuh < 44px (info, bukan gate): ${allSmallTargets.length} — ${JSON.stringify(smallByTag)}`
    );

    // Gate: pelanggaran critical/serious ATAU ada input tanpa label.
    if (failing.length > 0 || allUnlabeled.length > 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("A11Y AUDIT ERROR:", e);
  process.exitCode = 2;
});
