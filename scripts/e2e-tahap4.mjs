/**
 * Live API E2E — Tahap 4
 * Menjalankan waiver end-to-end, master data, dan site scoping terhadap backend
 * yang berjalan di http://localhost:3000 (database development/staging).
 *
 * Jalankan: node scripts/e2e-tahap4.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const PASSWORD = process.env.SEED_PASSWORD ?? 'KlinikLNG2026!';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✘ ${name} ${detail}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, body: json };
}

async function login(username) {
  const { status, body } = await req('POST', '/auth/login', {
    body: { username, password: PASSWORD },
  });
  if (status !== 200) throw new Error(`login ${username} failed (${status})`);
  return body.data.accessToken;
}

const d = (r) => r.body?.data;

async function main() {
  console.log(`\n== Tahap 4 E2E against ${BASE} ==\n`);

  const admin = await login('admin');
  const hseManager = await login('hse.manager');
  const hseOfficer = await login('hse.officer'); // SITE-OFFSHORE-01
  const hrPic = await login('hr.pic'); // HR_ADMIN, ORG
  const drKlinik = await login('dr.klinik'); // SITE-PLANT-01
  const nurse = await login('perawat');
  await login('apoteker');
  await login('manajemen');

  // ---------------------------------------------------------------- WAIVER
  console.log('-- Waiver end-to-end --');

  const unauth = await req('GET', '/waivers');
  check('GET /waivers tanpa token -> 401', unauth.status === 401, `got ${unauth.status}`);

  const nurseCreate = await req('POST', '/waivers', {
    token: nurse,
    body: { visitorName: 'X', purpose: 'Y', validUntil: '2026-12-01' },
  });
  check('POST /waivers sebagai perawat -> 403', nurseCreate.status === 403, `got ${nurseCreate.status}`);

  const mgrList = await req('GET', '/waivers?limit=50', { token: hseManager });
  const mgrWaivers = d(mgrList) ?? [];
  check('hse.manager (GLOBAL) melihat waiver lintas site', mgrWaivers.length >= 4, `got ${mgrWaivers.length}`);
  check(
    'lifecycle EXPIRED dihitung dari valid_until',
    mgrWaivers.some((w) => w.lifecycle === 'EXPIRED'),
  );
  check(
    'lifecycle REJECTED tersedia',
    mgrWaivers.some((w) => w.lifecycle === 'REJECTED'),
  );

  const offList = await req('GET', '/waivers?limit=50', { token: hseOfficer });
  const offWaivers = d(offList) ?? [];
  check(
    'hse.officer (SITE-OFFSHORE-01) hanya melihat waiver site-nya',
    offWaivers.length > 0 && offWaivers.every((w) => w.site?.code === 'SITE-OFFSHORE-01'),
    `got ${offWaivers.map((w) => w.site?.code).join(',')}`,
  );

  const hrList = await req('GET', '/waivers?limit=50', { token: hrPic });
  check('hr.pic (ORG scope) melihat seluruh site dalam organisasi', (d(hrList) ?? []).length >= 4);

  // create scoped
  const created = await req('POST', '/waivers', {
    token: hseOfficer,
    body: {
      visitorName: 'Flow Visitor',
      company: 'PT Flow',
      hostEmail: 'flow@example.com',
      purpose: 'Uji flow end-to-end',
      validUntil: '2026-12-05',
      exposureRisk: 'Rendah',
    },
  });
  const waiver = d(created);
  check('create waiver berhasil (201)', created.status === 201, `got ${created.status}`);
  check('waiver default site = site user', waiver?.site?.code === 'SITE-OFFSHORE-01', `got ${waiver?.site?.code}`);
  check('waiver baru berstatus PENDING', waiver?.lifecycle === 'PENDING');

  const outOfScope = await req('POST', '/waivers', {
    token: hseOfficer,
    body: { visitorName: 'X', purpose: 'Y', validUntil: '2026-12-01', siteCode: 'SITE-HO-JKT' },
  });
  check('create untuk site di luar scope -> 403', outOfScope.status === 403, `got ${outOfScope.status}`);

  // cross-site read: waiver di site HO dibuat oleh manager (GLOBAL),
  // lalu dibaca oleh hse.officer yang hanya punya site OFFSHORE.
  const hoWaiver = d(await req('POST', '/waivers', {
    token: hseManager,
    body: { visitorName: 'HO Target', purpose: 'Uji cross-site', validUntil: '2026-12-20', siteCode: 'SITE-HO-JKT' },
  }));
  const crossRead = await req('GET', `/waivers/${hoWaiver.id}`, { token: hseOfficer });
  check('read waiver site lain -> 404 (disamarkan)', crossRead.status === 404, `got ${crossRead.status}`);

  const crossRole = await req('GET', `/waivers/${waiver.id}`, { token: drKlinik });
  check('role tanpa izin baca waiver -> 403', crossRole.status === 403, `got ${crossRole.status}`);

  // send / token
  const sent = await req('POST', `/waivers/${waiver.id}/send`, { token: hseOfficer, body: {} });
  const devToken = d(sent)?.devToken;
  check('send consent menghasilkan devToken (non-production)', Boolean(devToken));

  const verify = await req('POST', '/public/waivers/verify', { body: { token: devToken } });
  check('public verify token valid', d(verify)?.valid === true, JSON.stringify(d(verify)));
  check(
    'public verify tidak membocorkan data klinis',
    !JSON.stringify(d(verify) ?? {}).match(/health|medication|deviation|declaration/i),
  );

  const badVerify = await req('POST', '/public/waivers/verify', { body: { token: 'deadbeef' } });
  check('public verify token salah -> 400', badVerify.status === 400, `got ${badVerify.status}`);

  const approve = await req('POST', `/public/waivers/${devToken}/approve`);
  check('public approve mengubah status', d(approve)?.decision === 'APPROVED', JSON.stringify(d(approve)));

  const replay = await req('POST', `/public/waivers/${devToken}/approve`);
  check('replay approve idempotent', d(replay)?.status === 'IDEMPOTENT', JSON.stringify(d(replay)));

  const wrongDecision = await req('POST', `/public/waivers/${devToken}/reject`);
  check('approve lalu reject -> 409 conflict', wrongDecision.status === 409, `got ${wrongDecision.status}`);

  const verifyUsed = await req('POST', '/public/waivers/verify', { body: { token: devToken } });
  check('token one-time: valid=false setelah dipakai', d(verifyUsed)?.valid === false);

  const mgrDecide = await req('POST', `/waivers/${waiver.id}/decision`, {
    token: hseManager,
    body: { status: 'APPROVED' },
  });
  check('HSE manager memutus waiver yang sudah di-approve visitor -> 409', mgrDecide.status === 409, `got ${mgrDecide.status}`);

  // revoke flow on a fresh waiver
  const w2 = d(await req('POST', '/waivers', {
    token: hseOfficer,
    body: { visitorName: 'Revoke Target', purpose: 'Uji revoke', validUntil: '2026-12-10', hostEmail: 'r@example.com' },
  }));
  const w2send = await req('POST', `/waivers/${w2.id}/send`, { token: hseOfficer, body: {} });
  const w2token = d(w2send)?.devToken;
  const revoked = await req('POST', `/waivers/${w2.id}/revoke`, { token: hseOfficer });
  check('revoke consent berstatus REVOKED', d(revoked)?.status === 'REVOKED');
  const useRevoked = await req('POST', `/public/waivers/${w2token}/approve`);
  check('token yang direvoke ditolak', useRevoked.status === 400, `got ${useRevoked.status}`);

  // perawat medical deny on waiver listing handled by roles (403 tested).

  // ------------------------------------------------------------ MASTER DATA
  console.log('-- Master Data --');

  const orgs = await req('GET', '/master-data/organizations', { token: admin });
  check('GET organizations (admin) -> 200', orgs.status === 200, `got ${orgs.status}`);
  check('organizations berisi data seed', Array.isArray(d(orgs)) && d(orgs).length >= 1);

  const nurseOrg = await req('GET', '/master-data/organizations', { token: nurse });
  check('GET organizations sebagai perawat -> 403', nurseOrg.status === 403, `got ${nurseOrg.status}`);

  const dupOrg = await req('POST', '/master-data/organizations', {
    token: admin,
    body: { code: 'LNG', name: 'Duplikat' },
  });
  check('create organization kode duplikat -> 409', dupOrg.status === 409, `got ${dupOrg.status}`);

  const newOrg = await req('POST', '/master-data/organizations', {
    token: admin,
    body: { code: `TEST-ORG-${Date.now()}`, name: 'Organisasi Uji Tahap 4' },
  });
  check('create organization baru -> 201', newOrg.status === 201, `got ${newOrg.status}`);
  const orgId = d(newOrg)?.id;

  const dept = await req('POST', '/master-data/departments', {
    token: admin,
    body: { organizationId: orgId, code: `TEST-DEPT-${Date.now()}`, name: 'Departemen Uji' },
  });
  check('create department -> 201', dept.status === 201, `got ${dept.status} ${JSON.stringify(d(dept))}`);
  const deptId = d(dept)?.id;

  const site = await req('POST', '/master-data/sites', {
    token: admin,
    body: {
      orgUnitId: deptId,
      code: `TEST-SITE-${Date.now()}`,
      name: 'Site Uji',
      siteType: 'ONSHORE_PLANT',
    },
  });
  check('create site -> 201', site.status === 201, `got ${site.status} ${JSON.stringify(d(site))}`);
  const siteId = d(site)?.id;

  const patchSite = await req('PATCH', `/master-data/sites/${siteId}`, {
    token: admin,
    body: { name: 'Site Uji (diubah)' },
  });
  check('update site -> 200', patchSite.status === 200 && d(patchSite)?.name === 'Site Uji (diubah)');

  const deactivate = await req('PATCH', `/master-data/sites/${siteId}/status`, {
    token: admin,
    body: { active: false },
  });
  check('deactivate site -> active=false', d(deactivate)?.active === false, JSON.stringify(d(deactivate)));

  const histSite = await req('GET', `/master-data/sites/${siteId}`, { token: admin });
  check('data inactive tetap dapat dibaca (histori)', d(histSite)?.active === false);

  const activeList = await req('GET', '/master-data/sites?active=true', { token: admin });
  check(
    'data inactive tidak muncul di daftar active',
    Array.isArray(d(activeList)) && !d(activeList).some((s) => s.id === siteId),
  );

  // ------------------------------------------------------------- SITE SCOPE
  console.log('-- Site scoping: patients & mcu --');

  const plantPatients = await req('GET', '/patients?limit=100', { token: drKlinik });
  const plantRows = d(plantPatients) ?? [];
  check(
    'dr.klinik (SITE-PLANT-01) hanya melihat pasien site-nya',
    plantRows.length > 0 && plantRows.every((p) => p.site === 'Onshore LNG Plant Bontang/Tangguh'),
    `got ${[...new Set(plantRows.map((p) => p.site))].join(',')}`,
  );

  const adminPatients = await req('GET', '/patients?limit=100', { token: admin });
  check('admin (GLOBAL) melihat pasien semua site', (d(adminPatients) ?? []).length >= 3);

  const adminMcu = await req('GET', '/mcu/cycles?limit=100', { token: admin });
  const plantMcu = await req('GET', '/mcu/cycles?limit=100', { token: drKlinik });
  const adminMcuCount = (d(adminMcu) ?? []).length;
  const plantMcuCount = (d(plantMcu) ?? []).length;
  check(
    'mcu/cycles ter-scope: site user <= GLOBAL',
    plantMcuCount <= adminMcuCount,
    `plant=${plantMcuCount} admin=${adminMcuCount}`,
  );

  // ------------------------------------------------------------- NOTIFIKASI
  const notif = await req('GET', '/notifications', { token: hseOfficer });
  check('GET /notifications (owner) -> 200', notif.status === 200, `got ${notif.status}`);

  const chain = await req('POST', '/iam/audit-logs/verify-chain', { token: admin });
  check('audit chain tetap valid (SHA-256)', d(chain)?.isValid === true, JSON.stringify(d(chain)));

  // ---------------------------------------------------------------- SUMMARY
  console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E fatal error:', err);
  process.exit(2);
});
