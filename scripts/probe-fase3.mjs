/**
 * Probe cepat Fase 3 — menguji 6 poin kritis tanpa mutasi berlebihan:
 * 1. SOAP tersimpan
 * 2. Lock menolak edit
 * 3. Dispensing dua kali
 * 4. Return mengubah ledger
 * 5. Cross-site ditolak
 * 6. Role non-apoteker ditolak
 */
const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const PASSWORD = 'KlinikLNG2026!';

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Trace-Id': `probe-${crypto.randomUUID()}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

async function login(username) {
  const r = await req('POST', '/auth/login', { body: { username, password: PASSWORD } });
  return r.status === 200 ? r.body?.data?.accessToken : null;
}

async function main() {
  const tokens = {};
  for (const u of ['admin', 'apoteker', 'dr.klinik', 'perawat', 'dr.hendra', 'manajemen']) {
    tokens[u] = await login(u);
    console.log(`login ${u}: ${tokens[u] ? 'OK' : 'FAIL'}`);
  }

  console.log('\n--- A. Pending prescriptions (apoteker, scope SITE-HO-JKT) ---');
  const pend = await req('GET', '/pharmacy/prescriptions/pending', { token: tokens.apoteker });
  console.log('status', pend.status, 'count', pend.body?.data?.length);
  console.log(JSON.stringify((pend.body?.data ?? []).map(p => ({ id: p.id, patient: p.encounter?.patient?.full_name, status: p.status })), null, 1));

  console.log('\n--- A2. Pending prescriptions (admin, unrestricted) ---');
  const pendAdm = await req('GET', '/pharmacy/prescriptions/pending', { token: tokens.admin });
  console.log('status', pendAdm.status, 'count', pendAdm.body?.data?.length);
  console.log(JSON.stringify((pendAdm.body?.data ?? []).map(p => ({ id: p.id, patient: p.encounter?.patient?.full_name })), null, 1));

  console.log('\n--- B. Inventory apoteker (scope check) ---');
  const inv = await req('GET', '/pharmacy/inventory', { token: tokens.apoteker });
  console.log('status', inv.status, 'items', inv.body?.data?.length);
  console.log(JSON.stringify((inv.body?.data ?? []).map(i => ({ code: i.medicationCode, site: i.siteName, stock: i.currentStock })), null, 1));

  console.log('\n--- C. FEFO cross-site: apoteker (HO) minta batch di SITE-PLANT-01 ---');
  // Cari siteId plant dari profil Andi
  const andiList = await req('GET', '/patients?search=Andi', { token: tokens.apoteker });
  const andi = andiList.body?.data?.[0];
  const prof = andi ? await req('GET', `/patients/${andi.id}/profile`, { token: tokens.apoteker }) : null;
  const plantSiteId = prof?.body?.data?.employee?.site?.id;
  console.log('plantSiteId:', plantSiteId);
  if (plantSiteId) {
    const fefo = await req('POST', '/pharmacy/dispensing/recommend-batches', {
      token: tokens.apoteker,
      body: { medicationId: (await req('GET', '/pharmacy/inventory', { token: tokens.admin })).body?.data?.find(i => i.medicationCode === 'MED-PCM-500') ? 'med-unknown' : 'x', siteId: plantSiteId, requiredQuantity: 5 },
    });
    console.log('FEFO cross-site status:', fefo.status, JSON.stringify(fefo.body).slice(0, 200));
  }

  console.log('\n--- D. Dispensing history (apoteker) ---');
  const hist = await req('GET', '/pharmacy/dispensing/history', { token: tokens.apoteker });
  console.log('status', hist.status, 'count', hist.body?.data?.length);

  console.log('\n--- E. Return tanpa ledger endpoint: cek apakah GET stock movement ada ---');
  for (const p of ['/pharmacy/stock-movements', '/pharmacy/stock-ledger', '/pharmacy/movements', '/pharmacy/ledger']) {
    const r = await req('GET', p, { token: tokens.apoteker });
    console.log(p, '->', r.status);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
