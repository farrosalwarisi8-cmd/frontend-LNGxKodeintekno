/**
 * Probe presisi Fase 3 — menentukan perilaku aktual backend untuk 6 bukti.
 * READ-ONLY terhadap kode backend; hanya memanggil API.
 */
const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const PASSWORD = 'KlinikLNG2026!';

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Trace-Id': `probe-${crypto.randomUUID()}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
async function login(u) {
  const r = await req('POST', '/auth/login', { body: { username: u, password: PASSWORD } });
  return r.status === 200 ? r.body?.data?.accessToken : null;
}

async function main() {
  const admin = await login('admin');
  const apoteker = await login('apoteker');
  const perawat = await login('perawat');
  const drKlinik = await login('dr.klinik');
  const drHendra = await login('dr.hendra');
  const manajemen = await login('manajemen');

  // --- Ambil ID site dari /iam/users (admin) ---
  const users = await req('GET', '/iam/users?page=1&limit=20', { token: admin });
  const apotekerUser = (users.body?.data ?? []).find(u => u.username === 'apoteker');
  const roles = apotekerUser?.user_roles ?? [];
  const siteIds = [...new Set(roles.map(r => r.site?.id).filter(Boolean))];
  const siteCodes = roles.map(r => r.site?.code).filter(Boolean);
  console.log('apoteker siteIds:', siteIds, 'codes:', siteCodes);

  // site plant dari profil Andi (admin bisa baca semua pasien)
  const andiList = await req('GET', '/patients?search=Andi', { token: admin });
  const andi = andiList.body?.data?.[0];
  const prof = andi ? await req('GET', `/patients/${andi.id}/profile`, { token: admin }) : null;
  const plantSiteId = prof?.body?.data?.employee?.site?.id;
  const plantSiteCode = prof?.body?.data?.employee?.site?.code;
  console.log('Andi site:', plantSiteCode, plantSiteId);

  const hoSiteId = siteIds.find(id => id !== plantSiteId) ?? siteIds[0];
  console.log('HO siteId:', hoSiteId);

  // --- 1. Cross-site: apoteker (HO) minta FEFO untuk site PLANT ---
  const medPcm = 'MED-PCM-500';
  // cari medicationId asli dari inventory admin
  const invAdm = await req('GET', '/pharmacy/inventory', { token: admin });
  const pcmRow = (invAdm.body?.data ?? []).find(i => i.medicationCode === 'MED-PCM-500');
  console.log('inventory admin PCM rows:', (invAdm.body?.data ?? []).filter(i => i.medicationCode === 'MED-PCM-500').map(i => ({ site: i.siteName, stock: i.currentStock })));

  // medicationId: dari pending prescription items (admin)
  const pendAdm = await req('GET', '/pharmacy/prescriptions/pending', { token: admin });
  const rx = pendAdm.body?.data?.[0];
  const medId = rx?.items?.[0]?.medication_id;
  console.log('rx pending (admin):', rx?.id, 'patient:', rx?.encounter?.patient?.full_name, 'medId:', medId, 'qty:', rx?.items?.[0]?.quantity);

  if (medId && plantSiteId) {
    const fefoCross = await req('POST', '/pharmacy/dispensing/recommend-batches', {
      token: apoteker,
      body: { medicationId: medId, siteId: plantSiteId, requiredQuantity: 5 },
    });
    console.log('\n[5] FEFO cross-site (apoteker HO -> site PLANT):', fefoCross.status, JSON.stringify(fefoCross.body).slice(0, 220));

    const fefoOwn = await req('POST', '/pharmacy/dispensing/recommend-batches', {
      token: apoteker,
      body: { medicationId: medId, siteId: hoSiteId, requiredQuantity: 5 },
    });
    console.log('[5] FEFO own-site (apoteker HO -> site HO):', fefoOwn.status, JSON.stringify(fefoOwn.body).slice(0, 220));
  }

  // --- inventory cross-site filter ---
  const invCross = await req('GET', `/pharmacy/inventory?siteId=${plantSiteId}`, { token: apoteker });
  console.log('[5] GET inventory?siteId=PLANT (apoteker HO):', invCross.status, 'items:', invCross.body?.data?.length);
  const invOwn = await req('GET', `/pharmacy/inventory?siteId=${hoSiteId}`, { token: apoteker });
  console.log('[5] GET inventory?siteId=HO (apoteker HO):', invOwn.status, 'items:', invOwn.body?.data?.length);

  // --- 6. Role non-apoteker ---
  for (const [name, tok] of [['perawat', perawat], ['dr.klinik', drKlinik], ['manajemen', manajemen]]) {
    const p = await req('GET', '/pharmacy/prescriptions/pending', { token: tok });
    const i = await req('GET', '/pharmacy/inventory', { token: tok });
    const d = await req('POST', '/pharmacy/dispensing', { token: tok, body: { prescriptionId: 'x', allocations: [] } });
    const r = await req('POST', '/pharmacy/returns', { token: tok, body: { dispensingId: 'x', stockBatchId: 'y', quantity: 1, reason: 'z' } });
    const rb = await req('POST', '/pharmacy/dispensing/recommend-batches', { token: tok, body: { medicationId: 'x', siteId: 'y', requiredQuantity: 1 } });
    console.log(`[6] ${name}: pending=${p.status} inventory=${i.status} dispense=${d.status} returns=${r.status} recommend=${rb.status}`);
  }

  // --- 3. Double dispensing (apoteker, rx Andi — cross-site sebenarnya, tapi backend tidak scope dispense) ---
  if (rx && medId && plantSiteId) {
    const fefo = await req('POST', '/pharmacy/dispensing/recommend-batches', {
      token: admin,
      body: { medicationId: medId, siteId: plantSiteId, requiredQuantity: 9 },
    });
    const batches = fefo.body?.data?.recommendedBatches ?? [];
    console.log('\n[3] FEFO (admin) untuk rx Andi:', batches.map(b => ({ batch: b.batchId, no: b.batchNo, alloc: b.allocated })));
    if (batches.length) {
      const allocations = batches.map(b => ({ stockBatchId: b.batchId, quantity: b.allocated }));
      const d1 = await req('POST', '/pharmacy/dispensing', { token: admin, body: { prescriptionId: rx.id, allocations } });
      console.log('[3] dispense #1:', d1.status, 'dispensingId:', d1.body?.data?.id);
      const d2 = await req('POST', '/pharmacy/dispensing', { token: admin, body: { prescriptionId: rx.id, allocations } });
      console.log('[3] dispense #2 (sama):', d2.status, JSON.stringify(d2.body).slice(0, 200));
    }
  }

  // --- pending setelah dispense ---
  const pendAfter = await req('GET', '/pharmacy/prescriptions/pending', { token: admin });
  console.log('\n_pending setelah dispensing:', pendAfter.body?.data?.length);
}

main().catch(e => { console.error(e); process.exit(1); });
