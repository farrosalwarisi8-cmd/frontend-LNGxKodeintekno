/**
 * Cek selarasan frontend ↔ backend (tanpa mengubah backend).
 *
 * Dua lapis pemeriksaan, keduanya terhadap backend hidup:
 *
 *  A. ENDPOINT — setiap path yang dipanggil `apiClient.*` di
 *     `src/lib/services/*.ts` dicocokkan dengan kontrak OpenAPI backend
 *     (`GET /docs-json`) lalu dikonfirmasi status HTTP aslinya memakai token
 *     sesi nyata (200 = selaras, 403 = role, 404 = route backend belum ada).
 *
 *  B. FIELD — kontrak tipe `interface Backend*` frontend dibandingkan dengan
 *     JSON sungguhan: satu halaman record dari endpoint yang menghasilkannya.
 *     Field yang dideklarasikan frontend tetapi tidak pernah ada pada respon
 *     backend = TIDAK selaras.
 *
 * Jalankan: dev server opsional, backend wajib hidup di :3000
 *   node scripts/check-backend-alignment.mjs
 * Artefak: test-artifacts/frontend-backend-alignment/report.json
 */
import fs from "node:fs";
import path from "node:path";

const API = (process.env.E2E_API_URL ?? "http://localhost:3000/api/v1").replace(/\/+$/, "");
const DOCS = (process.env.E2E_DOCS_URL ?? "http://localhost:3000/docs-json").replace(/\/+$/, "");
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/frontend-backend-alignment");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (area, id, name, status, detail = "") => {
  results.push({ area, id, name, status, detail });
  const icon =
    status === "PASS" ? "\u2713" : status === "FAIL" ? "\u2717" : status === "GAP" ? "\u25c7" : "\u25b3";
  console.log(`${icon} [${id}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
};

// ---------------------------------------------------------------------------
// A. Endpoint
// ---------------------------------------------------------------------------

/**
 * Normalisasi path pemanggilan frontend → bentuk route (`:p` = satu param).
 *
 * Menangani template literal bersarang, mis.
 *   `/master-data/organizations${qs ? `?${qs}` : ""}`
 *     → `/master-data/organizations`  (segmen berisi `?` = pembentuk query,
 *        bukan bagian path)
 *   `/documents/${documentId}/download`
 *     → `/documents/:p/download`
 */
function normalizeCallPath(raw) {
  let out = "";
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "$" && raw[i + 1] === "{") {
      let depth = 1;
      let j = i + 2;
      while (j < raw.length && depth > 0) {
        if (raw[j] === "{") depth++;
        else if (raw[j] === "}") depth--;
        if (depth === 0) break;
        j++;
      }
      const segment = raw.slice(i + 2, j);
      // Segmen pembentuk query string (berisi `?`) bukan bagian path.
      if (!segment.includes("?")) out += ":p";
      i = j + 1;
      continue;
    }
    out += raw[i];
    i++;
  }
  return out.split("?")[0].replace(/\/+$/, "") || "/";
}

/** Semua pemanggilan apiClient di service layer (string literal/template). */
function collectFrontendCalls() {
  const dir = "src/lib/services";
  const calls = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(dir, file), "utf8");
    const re = /apiClient\.(getPaged|get|post|put|patch|delete)(?:<[^<>]*>)?\(\s*(["'`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
    let m;
    while ((m = re.exec(src))) {
      const raw = m[3];
      const method = (m[1] === "getPaged" ? "get" : m[1]).toUpperCase();
      calls.push({ file, method, raw, path: normalizeCallPath(raw) });
    }
  }
  return calls;
}

function backendRoutes(spec) {
  const routes = [];
  for (const [p, ops] of Object.entries(spec.paths ?? {})) {
    for (const method of Object.keys(ops)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      routes.push({
        method: method.toUpperCase(),
        path: p.replace(/^\/api\/v1/, "").replace(/\{[^}]+\}/g, ":p"),
        raw: p,
      });
    }
  }
  return routes;
}

function routeMatches(calls, route) {
  return calls.some((c) => {
    if (c.method !== route.method) return false;
    const a = route.path.split("/").filter(Boolean);
    const b = c.path.split("/").filter(Boolean);
    return a.length === b.length && a.every((seg, i) => seg === b[i] || seg === ":p" || b[i] === ":p");
  });
}

// ---------------------------------------------------------------------------
// B. Field kontrak tipe frontend vs JSON backend
// ---------------------------------------------------------------------------

/**
 * Ambil daftar field level-atas dari blok interface.
 * Mengembalikan `[{ name, required }]` — `required=false` bila ditulis `name?:`.
 *
 * Catatan: field opsional (`?`) berarti "boleh tidak ada"; ketidakhadirannya
 * pada respon backend BUKAN ketidakselarasan. Yang dianggap selaras hanya
 * field yang dideklarasikan WAJIB ada di JSON backend.
 */
function topLevelFields(body) {
  const fields = [];
  let depth = 0;
  let buf = "";
  const push = (raw) => {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)(\?)?\s*:/);
    if (m) fields.push({ name: m[1], required: !m[2] });
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === ";" && depth === 0) {
      push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  push(buf);
  return fields;
}

function parseInterface(file, name) {
  const src = fs.readFileSync(file, "utf8");
  // Batas nama ketat: `BackendNotification` tidak boleh cocok dengan
  // `BackendNotificationTemplate`.
  const start = src.search(new RegExp(`interface ${name}\\s*(?:extends[^\\{]*)?\\{`));
  if (start < 0) return null;
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return topLevelFields(src.slice(open + 1, i));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sesi
// ---------------------------------------------------------------------------

async function login(username) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  const body = await res.json().catch(() => null);
  return body?.data?.accessToken ?? null;
}

async function get(token, urlPath) {
  const res = await fetch(`${API}${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, body: json };
}

/** Peta tipe frontend → (endpoint, penyusun payload). */
const FIELD_CASES = [
  { type: "BackendMcuCycle", file: "src/lib/services/mcu.service.ts", path: "/mcu/cycles?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendFtwAssessment", file: "src/lib/services/mcu.service.ts", path: "/mcu/cycles?page=1&limit=10", pick: (b) => (b?.data ?? []).map((r) => r.ftw_assessment).filter(Boolean) },
  { type: "BackendFtwRestriction", file: "src/lib/services/mcu.service.ts", path: "/mcu/cycles?page=1&limit=10", pick: (b) => (b?.data ?? []).flatMap((r) => r.ftw_assessment?.restrictions ?? []) },
  { type: "BackendDocument", file: "src/lib/services/document.service.ts", path: "/documents?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendQueueTicket", file: "src/lib/services/encounter.service.ts", path: "/clinic/queues", pick: (b) => b?.data ?? b },
  { type: "BackendNotification", file: "src/lib/services/notification.service.ts", path: "/notifications", pick: (b) => b?.data ?? b },
  { type: "BackendInventoryItem", file: "src/lib/services/pharmacy.service.ts", path: "/pharmacy/inventory", pick: (b) => b?.data ?? b },
  { type: "BackendPrescription", file: "src/lib/services/pharmacy.service.ts", path: "/pharmacy/prescriptions/pending", pick: (b) => b?.data ?? b },
  { type: "BackendListRow", file: "src/lib/services/patient.service.ts", path: "/patients?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendUserRow", file: "src/lib/services/iam.service.ts", path: "/iam/users?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendDaTest", file: "src/lib/services/da.service.ts", path: "/da/tests?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendWaiver", file: "src/lib/services/waiver.service.ts", path: "/waivers?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendAuditLogRow", file: "src/lib/services/iam.service.ts", path: "/iam/audit-logs?page=1&limit=10", pick: (b) => b?.data },
  { type: "BackendSite", file: "src/lib/services/master-data.service.ts", path: "/master-data/sites?active=true", pick: (b) => b?.data ?? b },
];

async function main() {
  const specRes = await fetch(DOCS);
  if (!specRes.ok) throw new Error(`OpenAPI tidak dapat diambil dari ${DOCS} (${specRes.status})`);
  const spec = await specRes.json();
  const routes = backendRoutes(spec);
  const calls = collectFrontendCalls();

  console.log(`[selaras] route backend terdaftar=${routes.length} · pemanggilan service frontend=${calls.length}\n`);

  // --- A. endpoint --------------------------------------------------------
  const tokens = {
    hse: await login("hse.officer"),
    apoteker: await login("apoteker"),
    lab: await login("lab.analis"),
  };
  if (!tokens.hse) throw new Error("login hse.officer gagal");

  const seen = new Map();
  for (const c of calls) {
    const key = `${c.method} ${c.path}`;
    if (seen.has(key)) continue;
    seen.set(key, c);
    const route = routes.find((r) => r.method === c.method && r.path === c.path) ?? null;
    const sample = c.path.replace(/:p/g, "00000000-0000-0000-0000-000000000000");
    const token = /pharmacy/.test(sample)
      ? tokens.apoteker
      : /da\//.test(sample)
        ? tokens.lab
        : tokens.hse;

    if (route) {
      // Route terdaftar di OpenAPI — konfirmasi status aslinya. 404 ber-arti
      // "entity tidak ditemukan" (param palsu), BUKAN route hilang.
      const live = await get(token, sample);
      const status = live.status;
      const routeMissing =
        status === 404 &&
        typeof live.body?.message === "string" &&
        /^Cannot (GET|POST|PUT|PATCH|DELETE)/.test(live.body.message);
      record(
        "endpoint",
        `E-${c.method}-${sample}`,
        `${c.method} ${sample}`,
        routeMissing ? "GAP" : status >= 500 ? "FAIL" : "PASS",
        routeMissing
          ? "terdaftar di OpenAPI tetapi route tidak aktif di backend"
          : status === 200
            ? "200 (route aktif & data terbaca)"
            : status === 403
              ? "403 — role uji tidak berwenang (route aktif, role lain yang sah)"
              : status === 404
                ? "404 entity (param uji tidak ada) — route aktif"
                : `status=${status}`
      );
      continue;
    }

    // Tidak ada di OpenAPI → pastikan memang route tidak ada
    // (pesan khas Nest: "Cannot METHOD /path").
    const live = await get(token, sample);
    const bodyMsg = typeof live.body?.message === "string" ? live.body.message : "";
    const reallyMissing = /^Cannot (GET|POST|PUT|PATCH|DELETE)/.test(bodyMsg);
    record(
      "endpoint",
      `E-${c.method}-${sample}`,
      `${c.method} ${sample}`,
      reallyMissing ? "GAP" : live.status >= 500 ? "FAIL" : "PASS",
      reallyMissing
        ? "route TIDAK terdaftar di backend (frontend tetap memanggilnya)"
        : `tidak tercatat di OpenAPI tetapi route menjawab status=${live.status}`
    );
  }

  // route backend yang tidak dipakai frontend (informasi)
  const unused = routes.filter((r) => !routeMatches(calls, r));
  console.log(`\n[i] Route backend tanpa pemanggil service frontend: ${unused.length}`);
  for (const r of unused) console.log(`     ${r.method.padEnd(6)} ${r.path}`);

  // --- B. field -----------------------------------------------------------
  console.log("");
  const targets = {
    hse: tokens.hse,
    apoteker: tokens.apoteker,
    lab: tokens.lab,
  };
  for (const cse of FIELD_CASES) {
    const declared = parseInterface(cse.file, cse.type);
    if (!declared) {
      record("field", `F-${cse.type}`, `interface ${cse.type}`, "FAIL", `tidak ditemukan di ${cse.file}`);
      continue;
    }
    const token =
      /pharmacy/.test(cse.path) ? targets.apoteker : /da\//.test(cse.path) ? targets.lab : targets.hse;
    const res = await get(token, cse.path);
    if (res.status !== 200) {
      record(
        "field",
        `F-${cse.type}`,
        `interface ${cse.type} vs ${cse.path}`,
        res.status === 404 ? "GAP" : "BLOCKED",
        res.status === 404 ? "endpoint tidak ada di backend (kontrak tidak bisa divalidasi)" : `status=${res.status}`
      );
      continue;
    }
    const records = (cse.pick(res.body) ?? []).filter((r) => r && typeof r === "object");
    if (records.length === 0) {
      record(
        "field",
        `F-${cse.type}`,
        `interface ${cse.type} vs ${cse.path}`,
        "BLOCKED",
        "endpoint 200 tetapi 0 record — field tidak bisa divalidasi"
      );
      continue;
    }
    const present = new Set();
    for (const r of records) for (const k of Object.keys(r)) present.add(k);
    // Hanya field WAJIB yang diwajibkan ada pada respon backend.
    const requiredMissing = declared
      .filter((f) => f.required && !present.has(f.name))
      .map((f) => f.name);
    const optionalMissing = declared
      .filter((f) => !f.required && !present.has(f.name))
      .map((f) => f.name);
    record(
      "field",
      `F-${cse.type}`,
      `interface ${cse.type} selaras dengan ${cse.path}`,
      requiredMissing.length === 0 ? "PASS" : "FAIL",
      requiredMissing.length === 0
        ? `${declared.filter((f) => f.required).length} field wajib semuanya ada` +
          (optionalMissing.length
            ? `; opsional tidak dikirim backend: ${optionalMissing.join(", ")}`
            : "")
        : `hilang padahal WAJIB: ${requiredMissing.join(", ")}`
    );
  }

  // --- ringkasan ----------------------------------------------------------
  const summary = {
    generatedAt: new Date().toISOString(),
    api: API,
    totals: {
      total: results.length,
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      gap: results.filter((r) => r.status === "GAP").length,
      blocked: results.filter((r) => r.status === "BLOCKED").length,
    },
    unusedBackendRoutes: unused.map((r) => `${r.method} ${r.path}`),
    results,
  };
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\nRINGKASAN SELARAS: total=${summary.totals.total} pass=${summary.totals.pass} fail=${summary.totals.fail} gap-backend=${summary.totals.gap} blocked=${summary.totals.blocked}`
  );
  if (summary.totals.fail > 0) {
    console.log(`FAIL: ${results.filter((r) => r.status === "FAIL").map((r) => r.id).join(", ")}`);
  }
  console.log(`Artefak: ${OUT}`);
  process.exit(summary.totals.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  record("fatal", "X", "Cek selarasan selesai", "FAIL", e?.message ?? String(e));
  process.exit(1);
});
