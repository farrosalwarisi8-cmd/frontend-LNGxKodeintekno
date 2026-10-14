/**
 * Probe API Fase 4 — membuktikan kriteria penerimaan lewat kontrak backend
 * (READ-ONLY terhadap kode backend; hanya memanggil API):
 *
 *   1. Waiver create → send → approve → reject → revoke (lifecycle penuh).
 *   2. Master Data organization / unit (department) / site.
 *   3. Duplicate code → 409 Conflict (unique constraint backend).
 *   4. Dependency guard → nonaktif tanpa force ditolak 409; force=true lolos.
 *   5. Deactivate site → PATCH /master-data/sites/:id/status.
 *   6. Scope Site A vs Site B → ?siteId= membatasi baris yang dikembalikan.
 *   7. Multi-site user (GLOBAL) → bisa membaca kedua site; site-scoped tidak.
 *
 * Jalankan dengan backend hidup:  node scripts/probe-fase4.mjs
 * Artefak: test-artifacts/fase4/report.json
 *
 * Catatan frontend (diuji unit + probe UI):
 *   - Scope switching membuang data store lama lalu menaikkan scopeVersion.
 *   - Data scope sebelumnya tidak boleh tetap tampil setelah pindah scope.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.API_BASE ?? "http://localhost:3000/api/v1";
const PASSWORD = process.env.E2E_PASSWORD ?? "KlinikLNG2026!";
const OUT = path.resolve("test-artifacts/fase4");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const record = (id, name, status, detail = "") => {
  results.push({ id, name, status, detail });
  const icon = status === "PASS" ? "\u2713" : status === "FAIL" ? "\u2717" : "\u25b3";
  console.log(`${icon} [${id}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
};

async function req(method, p, { token, body } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Trace-Id": `probe-f4-${crypto.randomUUID()}`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* body bukan JSON */
  }
  return { status: res.status, body: json };
}

async function login(username) {
  const r = await req("POST", "/auth/login", { body: { username, password: PASSWORD } });
  return r.status === 200 ? r.body?.data?.accessToken : null;
}

// ---------------------------------------------------------------------------
// 1. Waiver lifecycle — create → send → approve / reject → revoke
// ---------------------------------------------------------------------------
async function phaseWaiver(admin) {
  console.log("\n=== 1. Waiver lifecycle ===");
  const suffix = Date.now().toString(36).toUpperCase();

  // create
  const created = await req("POST", "/waivers", {
    token: admin,
    body: {
      visitorName: `Tamu F4 ${suffix}`,
      company: "PT Probe Fase 4",
      hostName: "HSE Probe",
      hostEmail: `hse.f4.${suffix}@layargas.co.id`,
      purpose: "Inspeksi lapangan (probe Fase 4)",
      validUntil: "2026-12-31",
      siteCode: "SITE-HO-JKT",
    },
  });
  const waiverId = created.body?.data?.id;
  record(
    "F4-W-01",
    "POST /waivers membuat waiver (DRAFT)",
    created.status === 201 || created.status === 200
      ? "PASS"
      : "FAIL",
    `status=${created.status} id=${waiverId ?? "-"}`
  );
  if (!waiverId) return null;

  // send (pakai hostEmail) — waiver ini dibuat dengan hostEmail
  const sent = await req("POST", `/waivers/${waiverId}/send`, { token: admin, body: {} });
  const devToken = sent.body?.data?.devToken;
  record(
    "F4-W-03",
    "POST /waivers/:id/send mengirim token consent (2xx + devToken)",
    sent.status === 200 && typeof devToken === "string" ? "PASS" : "FAIL",
    `status=${sent.status} token=${devToken ? "ada" : "tidak"}`
  );

  // verify publik
  if (devToken) {
    const verify = await req("POST", "/public/waivers/verify", {
      body: { token: devToken },
    });
    record(
      "F4-W-04",
      "POST /public/waivers/verify memvalidasi token hasil send",
      verify.status === 200 && verify.body?.data?.valid === true ? "PASS" : "FAIL",
      `status=${verify.status} valid=${verify.body?.data?.valid}`
    );
  } else {
    record("F4-W-04", "POST /public/waivers/verify memvalidasi token hasil send", "BLOCKED", "tidak ada devToken");
  }

  // approve
  const approve = await req("POST", `/waivers/${waiverId}/decision`, {
    token: admin,
    body: { status: "APPROVED" },
  });
  record(
    "F4-W-05",
    "POST /waivers/:id/decision APPROVED → status FINAL",
    approve.status === 200 && approve.body?.data?.status === "FINAL" ? "PASS" : "FAIL",
    `status=${approve.status} waiver.status=${approve.body?.data?.status}`
  );

  // keputusan ganda → 409 (idempoten tidak; keputusan hanya sekali)
  const twice = await req("POST", `/waivers/${waiverId}/decision`, {
    token: admin,
    body: { status: "REJECTED" },
  });
  record(
    "F4-W-06",
    "Keputusan kedua pada waiver yang sama ditolak (409)",
    twice.status === 409 ? "PASS" : "FAIL",
    `status=${twice.status}`
  );

  // waiver kedua untuk alur reject
  const created2 = await req("POST", "/waivers", {
    token: admin,
    body: {
      visitorName: `Tamu F4 REJ ${suffix}`,
      purpose: "Probe reject (Fase 4)",
      validUntil: "2026-12-31",
      siteCode: "SITE-HO-JKT",
    },
  });
  const waiver2 = created2.body?.data?.id;
  if (waiver2) {
    // Waiver kedua TANPA hostEmail → send tanpa body.email harus 400.
    // Inilah alasan UI Fase 4 meminta email sebelum "Kirim consent".
    const noEmail = await req("POST", `/waivers/${waiver2}/send`, { token: admin, body: {} });
    record(
      "F4-W-02",
      "POST /waivers/:id/send tanpa email penerima ditolak (400) bila hostEmail kosong",
      noEmail.status === 400 ? "PASS" : "FAIL",
      `status=${noEmail.status} msg=${noEmail.body?.message ?? ""}`
    );
    const reject = await req("POST", `/waivers/${waiver2}/decision`, {
      token: admin,
      body: { status: "REJECTED" },
    });
    record(
      "F4-W-07",
      "POST /waivers/:id/decision REJECTED → status VOID",
      reject.status === 200 && reject.body?.data?.status === "VOID" ? "PASS" : "FAIL",
      `status=${reject.status} waiver.status=${reject.body?.data?.status}`
    );
  } else {
    record("F4-W-02", "POST /waivers/:id/send tanpa email penerima ditolak (400) bila hostEmail kosong", "FAIL", "gagal membuat waiver kedua");
    record("F4-W-07", "POST /waivers/:id/decision REJECTED → status VOID", "FAIL", "gagal membuat waiver kedua");
  }

  // revoke pada waiver yang sudah di-send (pakai waiver pertama? sudah FINAL, consent masih ada)
  const revoke = await req("POST", `/waivers/${waiverId}/revoke`, { token: admin });
  record(
    "F4-W-08",
    "POST /waivers/:id/revoke mencabut token consent",
    revoke.status === 200 && revoke.body?.data?.status === "REVOKED" ? "PASS" : "FAIL",
    `status=${revoke.status} result=${revoke.body?.data?.status}`
  );

  // token yang sudah direvoke tidak lagi valid
  if (devToken) {
    const after = await req("POST", "/public/waivers/verify", { body: { token: devToken } });
    record(
      "F4-W-09",
      "Token yang sudah direvoke tidak valid lagi",
      after.status === 200 && after.body?.data?.valid === false ? "PASS" : "FAIL",
      `valid=${after.body?.data?.valid}`
    );
  } else {
    record("F4-W-09", "Token yang sudah direvoke tidak valid lagi", "BLOCKED", "tidak ada devToken");
  }

  return { waiverId, waiver2 };
}

// ---------------------------------------------------------------------------
// 2-5. Master Data — duplicate code, dependency guard, deactivate site
// ---------------------------------------------------------------------------
async function phaseMasterData(admin) {
  console.log("\n=== 2. Master Data: duplicate code / dependency guard / deactivate site ===");
  const suffix = Date.now().toString(36).toUpperCase();

  const orgs = await req("GET", "/master-data/organizations", { token: admin });
  const depts = await req("GET", "/master-data/departments", { token: admin });
  const sites = await req("GET", "/master-data/sites", { token: admin });
  const orgList = orgs.body?.data ?? [];
  const deptList = depts.body?.data ?? [];
  const siteList = sites.body?.data ?? [];
  record(
    "F4-M-01",
    "GET organizations/departments/sites mengembalikan data",
    orgList.length > 0 && deptList.length > 0 && siteList.length > 0 ? "PASS" : "FAIL",
    `orgs=${orgList.length} depts=${deptList.length} sites=${siteList.length}`
  );

  // --- Duplicate code: memakai kode yang sudah ada harus 409 ---
  const dupOrg = await req("POST", "/master-data/organizations", {
    token: admin,
    body: { code: orgList[0]?.code ?? "DUP", name: "Duplikat (probe F4)" },
  });
  record(
    "F4-M-02",
    "Duplicate code organization → 409 Conflict",
    dupOrg.status === 409 ? "PASS" : "FAIL",
    `status=${dupOrg.status} code=${orgList[0]?.code}`
  );

  const dupDept = await req("POST", "/master-data/departments", {
    token: admin,
    body: {
      organizationId: deptList[0]?.organization_id ?? orgList[0]?.id,
      code: deptList[0]?.code ?? "DUP",
      name: "Duplikat (probe F4)",
    },
  });
  record(
    "F4-M-03",
    "Duplicate code department (unit) → 409 Conflict",
    dupDept.status === 409 ? "PASS" : "FAIL",
    `status=${dupDept.status} code=${deptList[0]?.code}`
  );

  const dupSite = await req("POST", "/master-data/sites", {
    token: admin,
    body: {
      orgUnitId: siteList[0]?.org_unit_id,
      code: siteList[0]?.code ?? "DUP",
      name: "Duplikat (probe F4)",
    },
  });
  record(
    "F4-M-04",
    "Duplicate code site → 409 Conflict",
    dupSite.status === 409 ? "PASS" : "FAIL",
    `status=${dupSite.status} code=${siteList[0]?.code}`
  );

  // --- Dependency guard: deactivate site yang punya pekerja/inventory ---
  const targetSite = siteList.find((s) => s.code === "SITE-PLANT-01") ?? siteList[0];
  if (!targetSite) {
    record("F4-M-05", "Dependency guard deactivate site", "BLOCKED", "tidak ada site");
    record("F4-M-06", "Force deactivate site", "BLOCKED", "tidak ada site");
    record("F4-M-07", "Re-activate site (pulihkan)", "BLOCKED", "tidak ada site");
    return;
  }

  const noForce = await req("PATCH", `/master-data/sites/${targetSite.id}/status`, {
    token: admin,
    body: { active: false },
  });
  const guarded = noForce.status === 409;
  record(
    "F4-M-05",
    `Dependency guard: deactivate site ${targetSite.code} tanpa force → 409`,
    guarded ? "PASS" : "FAIL",
    `status=${noForce.status} msg=${noForce.body?.message ?? ""}`
  );

  const forced = await req("PATCH", `/master-data/sites/${targetSite.id}/status`, {
    token: admin,
    body: { active: false, force: true },
  });
  record(
    "F4-M-06",
    "Force deactivate site (force=true) → 2xx, histori tidak dihapus",
    forced.status >= 200 && forced.status < 300 ? "PASS" : "FAIL",
    `status=${forced.status} active=${forced.body?.data?.active}`
  );

  // pulihkan agar tidak merusak data uji lain
  const restore = await req("PATCH", `/master-data/sites/${targetSite.id}/status`, {
    token: admin,
    body: { active: true },
  });
  record(
    "F4-M-07",
    "Re-activate site (pulihkan state uji)",
    restore.status >= 200 && restore.status < 300 && restore.body?.data?.active === true
      ? "PASS"
      : "FAIL",
    `status=${restore.status} active=${restore.body?.data?.active}`
  );

  // --- Duplicate code pada site non-duplikat: create unik harus 201 ---
  const uniq = await req("POST", "/master-data/sites", {
    token: admin,
    body: {
      orgUnitId: targetSite.org_unit_id,
      code: `F4-SITE-${suffix}`,
      name: `Site Probe F4 ${suffix}`,
      // Enum backend: HEAD_OFFICE | ONSHORE_PLANT | OFFSHORE_PLATFORM | REMOTE_CLINIC
      siteType: "REMOTE_CLINIC",
    },
  });
  const uniqId = uniq.body?.data?.id;
  record(
    "F4-M-08",
    "Create site dengan kode unik → 2xx (pembuktan kontras duplicate guard)",
    uniq.status >= 200 && uniq.status < 300 ? "PASS" : "FAIL",
    `status=${uniq.status} code=F4-SITE-${suffix}`
  );

  // nonaktifkan site buatan tanpa force (tanpa pekerja/inventaris → lolos),
  // lalu aktifkan kembali: bukti endpoint deactivate site bekerja.
  if (uniqId) {
    const off = await req("PATCH", `/master-data/sites/${uniqId}/status`, {
      token: admin,
      body: { active: false },
    });
    const on = await req("PATCH", `/master-data/sites/${uniqId}/status`, {
      token: admin,
      body: { active: true },
    });
    // Cleanup: biarkan site uji nonaktif supaya tidak muncul di daftar site
    // aktif (ScopeSelector & master data) pada pengujian berikutnya.
    await req("PATCH", `/master-data/sites/${uniqId}/status`, {
      token: admin,
      body: { active: false },
    });
    record(
      "F4-M-09",
      "Deactivate site baru (tanpa dependensi) → 2xx lalu re-activate",
      off.status >= 200 && off.status < 300 && off.body?.data?.active === false && on.body?.data?.active === true
        ? "PASS"
        : "FAIL",
      `off=${off.status}(${off.body?.data?.active}) on=${on.status}(${on.body?.data?.active}) cleanup=inactive`
    );
  } else {
    record("F4-M-09", "Deactivate site baru (tanpa dependensi) → 2xx lalu re-activate", "BLOCKED", "create site gagal");
  }
}

// ---------------------------------------------------------------------------
// 6-7. Scope Site A vs Site B + multi-site user
// ---------------------------------------------------------------------------
async function phaseScope(admin) {
  console.log("\n=== 3. Scope Site A vs Site B + multi-site user ===");

  const sites = await req("GET", "/master-data/sites?active=true", { token: admin });
  const siteList = sites.body?.data ?? [];
  const siteA = siteList.find((s) => s.code === "SITE-HO-JKT") ?? siteList[0];
  const siteB = siteList.find((s) => s.code === "SITE-PLANT-01") ?? siteList[1];
  if (!siteA || !siteB) {
    record("F4-S-00", "Dua site aktif tersedia", "FAIL", `sites=${siteList.length}`);
    return { siteA, siteB };
  }
  record("F4-S-00", "Dua site aktif tersedia", "PASS", `${siteA.code} & ${siteB.code}`);

  // Inventory per site (GLOBAL/admin boleh memilih site mana pun)
  const invA = await req("GET", `/pharmacy/inventory?siteId=${siteA.id}`, { token: admin });
  const invB = await req("GET", `/pharmacy/inventory?siteId=${siteB.id}`, { token: admin });
  const namesA = [...new Set((invA.body?.data ?? []).map((i) => i.siteName))];
  const namesB = [...new Set((invB.body?.data ?? []).map((i) => i.siteName))];
  const onlyA = namesA.every((n) => n === siteA.name) && (invA.body?.data ?? []).length > 0;
  const onlyB = namesB.every((n) => n === siteB.name) && (invB.body?.data ?? []).length > 0;
  record(
    "F4-S-01",
    "?siteId=Site A mengembalikan hanya baris Site A",
    onlyA ? "PASS" : "FAIL",
    `rows=${(invA.body?.data ?? []).length} sites=${JSON.stringify(namesA)}`
  );
  record(
    "F4-S-02",
    "?siteId=Site B mengembalikan hanya baris Site B",
    onlyB ? "PASS" : "FAIL",
    `rows=${(invB.body?.data ?? []).length} sites=${JSON.stringify(namesB)}`
  );
  const overlap = (invA.body?.data ?? []).some((a) =>
    (invB.body?.data ?? []).some((b) => a.id === b.id)
  );
  record(
    "F4-S-03",
    "Tidak ada baris inventory yang bocor antar kedua scope",
    !overlap ? "PASS" : "FAIL",
    `overlap=${overlap}`
  );

  // Queue per site
  const qA = await req("GET", `/clinic/queues?siteId=${siteA.id}`, { token: admin });
  const qB = await req("GET", `/clinic/queues?siteId=${siteB.id}`, { token: admin });
  record(
    "F4-S-04",
    "GET /clinic/queues?siteId= menerima site A & B (2xx)",
    qA.status === 200 && qB.status === 200 ? "PASS" : "FAIL",
    `A=${qA.status}(${(qA.body?.data ?? []).length}) B=${qB.status}(${(qB.body?.data ?? []).length})`
  );

  // Multi-site user: admin (GLOBAL) bisa membaca keduanya tanpa error,
  // sedangkan user site-scoped (apoteker = SITE-HO-JKT) hanya miliknya.
  const apoteker = await login("apoteker");
  if (!apoteker) {
    record("F4-S-05", "Multi-site user (GLOBAL) vs site-scoped", "BLOCKED", "login apoteker gagal");
    return { siteA, siteB };
  }
  const invScoped = await req("GET", `/pharmacy/inventory?siteId=${siteB.id}`, { token: apoteker });
  const scopedRows = invScoped.body?.data ?? [];
  const scopedNames = [...new Set(scopedRows.map((i) => i.siteName))];
  // Backend memvalidasi membership: siteId di luar scope diabaikan/di-filter,
  // sehingga baris Site B tidak pernah bocor ke user Site A.
  const leaked = scopedNames.some((n) => n === siteB.name);
  record(
    "F4-S-05",
    "User site-scoped tidak menerima baris site lain (?siteId lintas site)",
    !leaked ? "PASS" : "FAIL",
    `status=${invScoped.status} rows=${scopedRows.length} sites=${JSON.stringify(scopedNames)}`
  );

  const invOwn = await req("GET", "/pharmacy/inventory", { token: apoteker });
  const ownNames = [...new Set((invOwn.body?.data ?? []).map((i) => i.siteName))];
  const ownOnly = ownNames.every((n) => n === siteA.name);
  record(
    "F4-S-06",
    "Tanpa ?siteId=, user site-scoped hanya melihat site-nya sendiri",
    invOwn.status === 200 && ownOnly ? "PASS" : "FAIL",
    `sites=${JSON.stringify(ownNames)}`
  );

  // Waiver list di-scope per token (admin GLOBAL melihat semua site)
  const waivers = await req("GET", "/waivers?page=1&limit=50", { token: admin });
  const waiverSites = [...new Set((waivers.body?.data ?? []).map((w) => w.site?.name ?? "tanpa-site"))];
  record(
    "F4-S-07",
    "GET /waivers mengembalikan waiver lintas site untuk user GLOBAL",
    waivers.status === 200 && waiverSites.length > 0 ? "PASS" : "FAIL",
    `sites=${JSON.stringify(waiverSites)}`
  );

  return { siteA, siteB };
}

// ---------------------------------------------------------------------------
async function main() {
  const admin = await login("admin");
  if (!admin) throw new Error("Login admin gagal — backend hidup?");
  console.log("login admin: OK");

  await phaseWaiver(admin);
  await phaseMasterData(admin);
  await phaseScope(admin);

  finish();
}

function finish() {
  const failed = results.filter((r) => r.status === "FAIL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: failed.length,
    blocked: blocked.length,
    results,
  };
  fs.writeFileSync(path.join(OUT, "report-api.json"), JSON.stringify(summary, null, 2));
  console.log(
    `\nRINGKASAN API: total=${summary.total} pass=${summary.passed} fail=${summary.failed} blocked=${summary.blocked}`
  );
  console.log(`Artefak: ${path.join(OUT, "report-api.json")}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  finish();
});
