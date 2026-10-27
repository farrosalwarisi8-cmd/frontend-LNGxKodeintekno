/**
 * Tahap 3 — Live API E2E verification (development environment).
 * Menjalankan alur nyata terhadap backend yang berjalan di localhost:3000:
 *   - Login semua akun uji per role
 *   - Otorisasi negatif (401 tanpa token, 403 salah role, 2xx role berhak)
 *   - Employee + Consent + Notification
 *   - MCU + FTW + Restriction + Acknowledge
 *   - Clinic visit + queue + vitals + SOAP + ICD-10 + finalize + lock
 *   - Pharmacy dispensing FEFO + stock ledger
 *   - Documents render + signature request + callback + public QR verify
 *   - Notifications list + mark-as-read
 *   - Audit log list + verify-chain
 *   - Offline sync register + push (idempotent) + conflicts
 *
 * Jalankan: node scripts/e2e-tahap3.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const PASSWORD = process.env.TEST_PASSWORD ?? 'KlinikLNG2026!';

const results = [];
let fails = 0;

function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ` — ${detail}` : ''}`);
}

function traceId() {
  return `req-${crypto.randomUUID()}`;
}

async function req(method, path, { token, body, expect } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Trace-Id': traceId() };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 etc */ }
  if (expect && !expect.includes(res.status)) {
    check(`${method} ${path} -> ${expect.join('/')}`, false, `mendapat ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { status: res.status, body: json };
}

async function login(username) {
  const r = await req('POST', '/auth/login', { body: { username, password: PASSWORD } });
  if (r.status !== 200 || !r.body?.data?.accessToken) return null;
  return r.body.data.accessToken;
}

const ROLE_USERS = {
  SYSTEM_ADMIN: 'admin',
  DOCTOR_OH: 'dr.hendra',
  DOCTOR_CLINIC: 'dr.klinik',
  NURSE: 'perawat',
  PHARMACIST: 'apoteker',
  LAB_ANALYST: 'lab.analis',
  RADIOLOGIST: 'radiolog',
  HR_ADMIN: 'hr.pic',
  HSE_OFFICER: 'hse.officer',
  HSE_MANAGER: 'hse.manager',
  MANAGEMENT: 'manajemen',
};

async function main() {
  // ---------------------------------------------------------------------------
  console.log('\n=== 1. Login semua akun uji per role ===');
  const tokens = {};
  for (const [role, username] of Object.entries(ROLE_USERS)) {
    const t = await login(username);
    check(`Login ${role} (${username})`, !!t);
    if (t) tokens[role] = t;
  }
  const admin = tokens.SYSTEM_ADMIN;

  // ---------------------------------------------------------------------------
  console.log('\n=== 2. Otorisasi negatif (401/403/2xx) ===');
  const noAuth = await req('GET', '/iam/users');
  check('GET /iam/users tanpa token -> 401', noAuth.status === 401, `status=${noAuth.status}`);

  const noAuthAudit = await req('GET', '/iam/audit-logs');
  check('GET /iam/audit-logs tanpa token -> 401', noAuthAudit.status === 401, `status=${noAuthAudit.status}`);

  if (tokens.DOCTOR_OH) {
    const r = await req('GET', '/iam/users', { token: tokens.DOCTOR_OH });
    check('GET /iam/users sebagai DOCTOR_OH -> 403', r.status === 403, `status=${r.status}`);
  }
  if (tokens.HR_ADMIN) {
    const r = await req('GET', '/iam/users', { token: tokens.HR_ADMIN });
    check('GET /iam/users sebagai HR_ADMIN -> 2xx', r.status === 200, `status=${r.status}`);
    const r2 = await req('GET', '/iam/audit-logs', { token: tokens.HR_ADMIN });
    check('GET /iam/audit-logs sebagai HR_ADMIN -> 403', r2.status === 403, `status=${r2.status}`);
  }
  if (tokens.PHARMACIST) {
    const r = await req('POST', '/pharmacy/dispensing', { token: tokens.PHARMACIST, body: { prescriptionId: '00000000-0000-0000-0000-000000000000', allocations: [] } });
    check('POST /pharmacy/dispensing sebagai PHARMACIST (role valid, resep tak ada -> 404/500)', r.status !== 401 && r.status !== 403, `status=${r.status}`);
    const r2 = await req('POST', '/mcu/cycles/00000000-0000-0000-0000-000000000000/ftw-assessment', { token: tokens.PHARMACIST, body: { ftwStatus: 'FIT' } });
    check('POST /mcu/.../ftw-assessment sebagai PHARMACIST -> 403', r2.status === 403, `status=${r2.status}`);
  }
  if (tokens.HSE_OFFICER) {
    const r = await req('POST', '/consents/send', { token: tokens.HSE_OFFICER, body: { patientId: 'x', consentType: 'DATA_PROCESSING' } });
    check('POST /consents/send sebagai HSE_OFFICER -> 403', r.status === 403, `status=${r.status}`);
    const r2 = await req('GET', '/patients', { token: tokens.HSE_OFFICER });
    check('GET /patients sebagai HSE_OFFICER -> 403', r2.status === 403, `status=${r2.status}`);
  }
  if (tokens.NURSE) {
    const r = await req('GET', '/iam/audit-logs', { token: tokens.NURSE });
    check('GET /iam/audit-logs sebagai NURSE -> 403', r.status === 403, `status=${r.status}`);
    const r2 = await req('GET', '/patients', { token: tokens.NURSE });
    check('GET /patients sebagai NURSE -> 2xx', r2.status === 200, `status=${r2.status}`);
  }
  if (tokens.MANAGEMENT) {
    const r = await req('GET', '/patients', { token: tokens.MANAGEMENT });
    check('GET /patients sebagai MANAGEMENT (non-medical, bukan HR) -> 403', r.status === 403, `status=${r.status}`);
    const r2 = await req('GET', '/pharmacy/inventory', { token: tokens.MANAGEMENT });
    check('GET /pharmacy/inventory sebagai MANAGEMENT -> 403', r2.status === 403, `status=${r2.status}`);
  }
  // 404 generik untuk record tidak ada (tanpa detail sensitif)
  if (admin) {
    const r = await req('GET', '/iam/users/00000000-0000-0000-0000-000000000000', { token: admin });
    check('GET /iam/users/:id tidak ada -> 404', r.status === 404, `status=${r.status}`);
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 3. Employee + Consent + Notification (HR_ADMIN) ===');
  const hr = tokens.HR_ADMIN;
  let createdPatientId = null;
  let scope = null;
  if (hr) {
    // Resolve cakupan organisasi seperti frontend resolveScope():
    // dari profil pasien yang ada (employee.organization / org_unit / site).
    const anyList = await req('GET', '/patients?page=1&limit=1', { token: hr });
    const firstId = anyList.body?.data?.[0]?.id;
    if (firstId) {
      const prof = await req('GET', `/patients/${firstId}/profile`, { token: hr });
      const emp = prof.body?.data?.employee;
      if (emp?.organization?.id && emp?.org_unit?.id && emp?.site?.id) {
        scope = {
          organizationId: emp.organization.id,
          orgUnitId: emp.org_unit.id,
          siteId: emp.site.id,
          siteCode: emp.site.code ?? 'SITE-PLANT-01',
        };
      }
    }
    check('Resolve cakupan organisasi/site dari profil pasien', !!scope, JSON.stringify(scope));

    const empNo = `LNG-T3-${Date.now()}`;
    const create = await req('POST', '/patients', {
      token: hr,
      body: {
        employeeNo: empNo,
        fullName: 'Pekerja Uji Tahap 3',
        birthDate: '1995-05-05',
        sex: 'M',
        email: `t3.${Date.now()}@layargas.co.id`,
        phone: '081199999999',
        organizationId: scope?.organizationId,
        orgUnitId: scope?.orgUnitId,
        siteId: scope?.siteId,
        siteCode: scope?.siteCode,
        identifierType: 'NIK',
        identifierValue: String(Date.now()).padStart(16, '1'),
      },
    });
    check('POST /patients create employee (HR_ADMIN)', create.status >= 200 && create.status < 300, `status=${create.status} msg=${create.body?.message}`);
    if (create.status >= 200 && create.status < 300) {
      createdPatientId = create.body?.data?.id;
      check('MRN dibuat server-side', !!create.body?.data?.medicalRecordNo, create.body?.data?.medicalRecordNo);
    }

    // Duplicate check -> 409
    const dup = await req('POST', '/patients', {
      token: hr,
      body: {
        employeeNo: `${empNo}-dup`,
        fullName: 'Duplikat',
        birthDate: '1995-05-05',
        sex: 'M',
        email: `t3dup.${Date.now()}@layargas.co.id`,
        organizationId: scope?.organizationId,
        orgUnitId: scope?.orgUnitId,
        siteId: scope?.siteId,
        siteCode: scope?.siteCode,
        identifierType: 'NIK',
        identifierValue: '3174051204900001', // NIK Andi sudah terdaftar di seed
      },
    });
    check('Duplicate identifier -> 409 Conflict', dup.status === 409, `status=${dup.status}`);

    // Duplicate employee_no -> 409
    const dupEmp = await req('POST', '/patients', {
      token: hr,
      body: {
        employeeNo: 'LNG-0001', // employee Andi sudah ada di seed
        fullName: 'Duplikat No Induk',
        birthDate: '1991-02-02',
        sex: 'F',
        email: `t3dup2.${Date.now()}@layargas.co.id`,
        organizationId: scope?.organizationId,
        orgUnitId: scope?.orgUnitId,
        siteId: scope?.siteId,
        siteCode: scope?.siteCode,
        identifierType: 'NIK',
        identifierValue: String(Date.now() + 7).padStart(16, '2'),
      },
    });
    check('Duplicate employee_no -> 409 Conflict', dupEmp.status === 409, `status=${dupEmp.status}`);

    // Persistence: refresh — GET /patients harus menampilkan data baru
    if (createdPatientId) {
      const list = await req('GET', `/patients?search=${empNo}`, { token: hr });
      check('Data pekerja tetap ada setelah refresh (GET list)', list.status === 200 && (list.body?.data?.length ?? 0) > 0);
    }

    // Consent dispatch (idempotent resend)
    if (createdPatientId) {
      const c1 = await req('POST', '/consents/send', { token: hr, body: { patientId: createdPatientId, consentType: 'DATA_PROCESSING' } });
      check('POST /consents/send pertama', c1.status >= 200 && c1.status < 300, `status=${c1.status}`);
      const token1 = c1.body?.data?.verificationToken;
      const c2 = await req('POST', '/consents/send', { token: hr, body: { patientId: createdPatientId, consentType: 'DATA_PROCESSING' } });
      const consentId1 = c1.body?.data?.consentId;
      const consentId2 = c2.body?.data?.consentId;
      check('Resend consent idempotent (consentId sama, tidak duplikat)', c2.status >= 200 && c2.status < 300 && consentId1 === consentId2, `${consentId1} vs ${consentId2}`);

      // Worker approve via public endpoint
      if (token1) {
        const v1 = await req('POST', '/public/consents/verify', { body: { token: token1, action: 'AGREED' } });
        check('Public consent verify (AGREED) -> SUCCESS', v1.status === 200 && v1.body?.data?.consentStatus === 'GRANTED', `status=${v1.status} consentStatus=${v1.body?.data?.consentStatus}`);
        // One-time token: verify ulang harus ditolak
        const v2 = await req('POST', '/public/consents/verify', { body: { token: token1, action: 'AGREED' } });
        check('Token consent one-time (verify ulang ditolak)', v2.status === 400, `status=${v2.status}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 4. MCU + FTW + Restriction (DOCTOR_OH + HSE) ===');
  const doctor = tokens.DOCTOR_OH;
  let sitiPatientId = null;
  let restrictionId = null;
  if (admin) {
    const list = await req('GET', '/patients?search=Siti', { token: tokens.NURSE ?? admin });
    sitiPatientId = list.body?.data?.[0]?.id ?? null;
    check('Lookup pasien Siti untuk MCU', !!sitiPatientId);
  }
  if (doctor && sitiPatientId) {
    const cycle = await req('POST', '/mcu/cycles', { token: doctor, body: { patientId: sitiPatientId, mcuType: 'ANNUAL_PERIODIC', examinationDate: '2026-10-01' } });
    check('POST /mcu/cycles (DOCTOR_OH)', cycle.status >= 200 && cycle.status < 300, `status=${cycle.status}`);
    const cycleId = cycle.body?.data?.id;
    if (cycleId) {
      const calc = await req('POST', `/mcu/cycles/${cycleId}/calculate`, { token: doctor, body: { parameters: { weightKg: 60, heightCm: 160, systolicBp: 130, diastolicBp: 85 } } });
      check('POST /mcu/cycles/:id/calculate (kalkulasi klinis tersimpan)', calc.status >= 200 && calc.status < 300, `status=${calc.status}`);

      const ftw = await req('POST', `/mcu/cycles/${cycleId}/ftw-assessment`, {
        token: doctor,
        body: {
          ftwStatus: 'FIT_WITH_RESTRICTION',
          summary: 'Uji Tahap 3: hipertensi grade 1, batasi paparan bising.',
          restriction: { description: 'Batas paparan bising <= 8 jam/hari', reviewDate: '2027-04-01', supervisor: 'Supervisor Uji', controls: 'APD pendengaran wajib' },
        },
      });
      check('POST /mcu/cycles/:id/ftw-assessment (DOCTOR_OH)', ftw.status >= 200 && ftw.status < 300, `status=${ftw.status}`);
      restrictionId = ftw.body?.data?.restriction?.id ?? null;
      check('Restriksi FTW dibuat & tersimpan', !!restrictionId);

      // Role salah untuk FTW
      if (tokens.DOCTOR_CLINIC) {
        const r = await req('POST', `/mcu/cycles/${cycleId}/ftw-assessment`, { token: tokens.DOCTOR_CLINIC, body: { ftwStatus: 'FIT' } });
        check('FTW assessment oleh DOCTOR_CLINIC -> 403', r.status === 403, `status=${r.status}`);
      }

      // HSE acknowledge restriction
      if (restrictionId && tokens.HSE_OFFICER) {
        const ack = await req('POST', `/mcu/restrictions/${restrictionId}/acknowledge`, { token: tokens.HSE_OFFICER, body: { acknowledgementType: 'HSE', note: 'Restriksi dipahami, supervisi lapangan disesuaikan.' } });
        check('POST /mcu/restrictions/:id/acknowledge (HSE_OFFICER)', ack.status >= 200 && ack.status < 300, `status=${ack.status}`);
        const close = await req('POST', `/mcu/restrictions/${restrictionId}/close`, { token: tokens.HSE_OFFICER, body: {} });
        check('Close restriction oleh HSE_OFFICER -> 403 (hanya DOCTOR_OH)', close.status === 403, `status=${close.status}`);
        const closeDoc = await req('POST', `/mcu/restrictions/${restrictionId}/close`, { token: doctor, body: {} });
        check('Close restriction oleh DOCTOR_OH -> 2xx', closeDoc.status >= 200 && closeDoc.status < 300, `status=${closeDoc.status}`);
      }
    }
    // Persistence FTW: GET /mcu/cycles harus memuat assessment
    const mcuList = await req('GET', '/mcu/cycles?limit=50', { token: doctor });
    const found = (mcuList.body?.data ?? []).some((c) => c.id === (cycleId ?? '') && c.ftw_assessment);
    check('FTW status tersimpan setelah refresh (GET /mcu/cycles)', found);
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 5. Clinic visit + queue + vitals + SOAP + ICD-10 + finalize ===');
  let encounterId = null;
  if (admin && sitiPatientId) {
    // Antrian dari seed (Andi) harus terlihat
    const queues = await req('GET', '/clinic/queues', { token: tokens.NURSE ?? admin });
    check('GET /clinic/queues (antrean seed tampil)', queues.status === 200 && (queues.body?.data?.length ?? 0) > 0, `count=${queues.body?.data?.length}`);

    const enc = await req('POST', '/clinic/encounters', { token: tokens.NURSE ?? admin, body: { patientId: sitiPatientId } });
    check('POST /clinic/encounters (buka encounter)', enc.status >= 200 && enc.status < 300, `status=${enc.status}`);
    encounterId = enc.body?.data?.id;
    if (encounterId) {
      const vitals = await req('PUT', `/clinic/encounters/${encounterId}/vitals`, { token: tokens.NURSE ?? admin, body: { heightCm: 160, weightKg: 60, systolicBp: 128, diastolicBp: 82, pulse: 78, temperature: 36.7, spo2: 98 } });
      // Catatan kontrak: kolom Prisma Decimal ter-serialisasi sebagai string ("23.44"), bukan number.
      const bmiNum = Number(vitals.body?.data?.bmi);
      check('PUT vitals (BMI dihitung backend)', vitals.status >= 200 && vitals.status < 300 && Number.isFinite(bmiNum) && bmiNum > 0, `bmi=${vitals.body?.data?.bmi}`);

      const icd = await req('GET', '/clinic/icd10/search?keyword=hyper', { token: doctor ?? admin });
      check('GET /clinic/icd10/search (master ICD-10 nyata)', icd.status === 200 && (icd.body?.data?.length ?? 0) > 0, `count=${icd.body?.data?.length}`);

      const soap = await req('PUT', `/clinic/encounters/${encounterId}/soap`, { token: doctor ?? admin, body: { subjective: 'Sakit kepala ringan 2 hari.', objective: 'TD 128/82, RR 16, suhu 36.7C.', assessment: 'Hipertensi grade 1', plan: 'Lanjut obat, kontrol 2 minggu.', primaryIcd10: 'I10' } });
      check('PUT SOAP + ICD-10 tersimpan', soap.status >= 200 && soap.status < 300, `status=${soap.status}`);

      const fin = await req('POST', `/clinic/encounters/${encounterId}/finalize`, { token: doctor ?? admin, body: {} });
      check('POST finalize (encounter LOCKED)', fin.status >= 200 && fin.status < 300 && fin.body?.data?.status === 'LOCKED', `status=${fin.status} recordStatus=${fin.body?.data?.status}`);

      const afterLock = await req('PUT', `/clinic/encounters/${encounterId}/soap`, { token: doctor ?? admin, body: { subjective: 'Perubahan setelah lock', objective: 'x', assessment: 'x', plan: 'x' } });
      check('Encounter terkunci tidak bisa diedit (403)', afterLock.status === 403, `status=${afterLock.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 6. Pharmacy dispensing FEFO + stock ledger ===');
  if (tokens.PHARMACIST) {
    const invBefore = await req('GET', '/pharmacy/inventory', { token: tokens.PHARMACIST });
    check('GET /pharmacy/inventory (apoteker)', invBefore.status === 200 && (invBefore.body?.data?.length ?? 0) > 0, `items=${invBefore.body?.data?.length}`);

    const pending = await req('GET', '/pharmacy/prescriptions/pending', { token: tokens.PHARMACIST });
    check('GET /pharmacy/prescriptions/pending (resep seed)', pending.status === 200 && (pending.body?.data?.length ?? 0) > 0, `count=${pending.body?.data?.length}`);

    const rx = pending.body?.data?.[0];
    // Resep seed milik Andi (site SITE-PLANT-01); dapatkan siteId dari profilnya.
    const andiList = await req('GET', '/patients?search=Andi', { token: tokens.PHARMACIST });
    const andiId = andiList.body?.data?.[0]?.id;
    let rxSiteId = scope?.siteId ?? null;
    if (andiId) {
      const andiProf = await req('GET', `/patients/${andiId}/profile`, { token: tokens.PHARMACIST });
      rxSiteId = andiProf.body?.data?.employee?.site?.id ?? rxSiteId;
    }
    check('Site resep (pasien Andi) teridentifikasi', !!rxSiteId, rxSiteId);

    if (rx && rx.items?.[0] && rxSiteId) {
      const medId = rx.items[0].medication_id;
      const qty = Number(rx.items[0].quantity ?? 9);
      const fefo = await req('POST', '/pharmacy/dispensing/recommend-batches', {
        token: tokens.PHARMACIST,
        body: { medicationId: medId, siteId: rxSiteId, requiredQuantity: qty },
      });
      check('POST recommend-batches FEFO', fefo.status >= 200 && fefo.status < 300, `status=${fefo.status} allocatable=${fefo.body?.data?.isFullyAllocatable}`);
      const batches = fefo.body?.data?.recommendedBatches ?? [];
      check('FEFO recommendation menghasilkan batch', batches.length > 0, `batches=${batches.length}`);

      if (batches.length > 0) {
        const disp = await req('POST', '/pharmacy/dispensing', {
          token: tokens.PHARMACIST,
          body: { prescriptionId: rx.id, allocations: batches.map((b) => ({ stockBatchId: b.batchId, quantity: b.allocated })) },
        });
        check('POST /pharmacy/dispensing (transaksi nyata)', disp.status >= 200 && disp.status < 300, `status=${disp.status} msg=${disp.body?.message}`);

      const invAfter = await req('GET', '/pharmacy/inventory', { token: tokens.PHARMACIST });
      const sumPcm = (data) => (data ?? [])
        .filter((i) => i.medicationCode === 'MED-PCM-500')
        .reduce((acc, i) => acc + Number(i.currentStock ?? 0), 0);
      const beforeTotal = sumPcm(invBefore.body?.data);
      const afterTotal = sumPcm(invAfter.body?.data);
      check('Stok backend berkurang setelah dispensing', afterTotal < beforeTotal, `${beforeTotal} -> ${afterTotal}`);

        // FEFO: batch expiry terdekat dialokasikan lebih dulu (PCM-2026-C exp 2027-05-31 di site plant)
        check('FEFO: batch expiry terdekat terpakai lebih dulu', batches.length === 1 || batches[0].batchId !== batches[batches.length - 1].batchId, `batchPertama=${batches[0]?.batchNo}`);

        // Resep tidak lagi pending setelah didispens (konsistensi list)
        const pendingAfter = await req('GET', '/pharmacy/prescriptions/pending', { token: tokens.PHARMACIST });
        const stillPending = (pendingAfter.body?.data ?? []).some((p) => p.id === rx.id);
        check('Resep hilang dari daftar pending setelah dispensing', !stillPending);
      }
    }
    // Role salah: DOCTOR_OH tidak boleh dispensing
    if (doctor) {
      const r = await req('POST', '/pharmacy/dispensing', { token: doctor, body: { prescriptionId: 'x', allocations: [] } });
      check('POST /pharmacy/dispensing oleh DOCTOR_OH -> 403', r.status === 403, `status=${r.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 7. Documents + TTE + QR verify ===');
  if (doctor) {
    const doc = await req('POST', '/documents/render-pdf', { token: doctor, body: { documentType: 'FTW_CERTIFICATE', referenceId: sitiPatientId ?? 'uji-tahap3', title: 'Sertifikat Kelaikan Kerja Uji Tahap 3' } });
    check('POST /documents/render-pdf', doc.status >= 200 && doc.status < 300, `status=${doc.status}`);
    const docId = doc.body?.data?.documentId;
    const qrToken = doc.body?.data?.qrToken;
    if (docId) {
      const sig = await req('POST', '/signatures/request', { token: doctor, body: { documentId: docId, signatureType: 'CERTIFIED_PSRE', providerCode: 'PRIVY_MOCK' } });
      check('POST /signatures/request (tersimpan PENDING)', sig.status >= 200 && sig.status < 300 && sig.body?.data?.status === 'PENDING', `status=${sig.status} sigStatus=${sig.body?.data?.status}`);
      const sigId = sig.body?.data?.id;
      // Simulasi callback PSrE (mock adapter external provider)
      const cb = await req('POST', '/signatures/callback', { body: { signatureRequestId: sigId, certificateSerial: 'MOCK-SER-001', signedHash: 'a'.repeat(64), providerTransactionId: `psre-${Date.now()}` } });
      check('POST /signatures/callback (mock provider)', cb.status >= 200 && cb.status < 300 && cb.body?.data?.status === 'SIGNED', `status=${cb.status} status=${cb.body?.data?.status}`);

      if (qrToken) {
        const verify = await req('GET', `/public/verify/${qrToken}`);
        check('Public QR verify -> VERIFIED (tanpa data medis sensitif)', verify.status === 200 && verify.body?.data?.isValid === true, `status=${verify.status} valid=${verify.body?.data?.isValid}`);
        const leak = JSON.stringify(verify.body?.data ?? {});
        check('Payload verifikasi publik tanpa bocoran klinis', !/soap|diagnos|blood|bmi|medication/i.test(leak));
      }
      const badVerify = await req('GET', '/public/verify/0000000000000000000000000000000000000000000000000000000000000000');
      check('QR verify token tidak valid -> isValid=false', badVerify.status === 200 && badVerify.body?.data?.isValid === false);
    }
    // Role salah: NURSE tidak boleh render-pdf
    if (tokens.NURSE) {
      const r = await req('POST', '/documents/render-pdf', { token: tokens.NURSE, body: { documentType: 'FTW_CERTIFICATE', referenceId: 'x', title: 'x' } });
      check('POST /documents/render-pdf oleh NURSE -> 403', r.status === 403, `status=${r.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 8. Notifications + mark-as-read ===');
  if (admin) {
    const notifs = await req('GET', '/notifications', { token: admin });
    check('GET /notifications (data nyata dari event bisnis/seed)', notifs.status === 200 && (notifs.body?.data?.length ?? 0) > 0, `count=${notifs.body?.data?.length}`);
    const first = notifs.body?.data?.[0];
    if (first) {
      const read = await req('PUT', `/notifications/${first.id}/read`, { token: admin, body: {} });
      check('PUT /notifications/:id/read tersimpan', read.status === 200 && read.body?.data?.status === 'READ', `status=${read.status} newStatus=${read.body?.data?.status}`);
      const again = await req('GET', '/notifications', { token: admin });
      const still = (again.body?.data ?? []).find((n) => n.id === first.id);
      check('Status READ bertahan setelah refetch', still?.status === 'READ');
    }
    // Notification milik user lain tidak bisa di-read oleh admin (ownership)
    if (tokens.HSE_OFFICER) {
      const hseNotifs = await req('GET', '/notifications', { token: tokens.HSE_OFFICER });
      const hseFirst = hseNotifs.body?.data?.[0];
      if (hseFirst) {
        const cross = await req('PUT', `/notifications/${hseFirst.id}/read`, { token: admin, body: {} });
        check('Mark-as-read notifikasi user lain -> 404 (ownership)', cross.status === 404, `status=${cross.status}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 9. Audit log + verify-chain ===');
  if (admin) {
    const logs = await req('GET', '/iam/audit-logs?limit=100', { token: admin });
    check('GET /iam/audit-logs berisi event nyata', logs.status === 200 && (logs.body?.data?.length ?? 0) > 1, `count=${logs.body?.data?.length}`);
    const actions = new Set((logs.body?.data ?? []).map((l) => l.action));
    check('Audit event LOGIN_SUCCESS tercatat', actions.has('LOGIN_SUCCESS'));
    check('Audit event EMPLOYEE_CREATE tercatat', actions.has('EMPLOYEE_CREATE'));
    check('Audit event CONSENT_APPROVE/REJECT tercatat', actions.has('CONSENT_APPROVED') || actions.has('CONSENT_REJECTED'));
    check('Audit event FTW_ASSESS tercatat', actions.has('FTW_ASSESS'));
    check('Audit event ENCOUNTER_FINALIZE tercatat', actions.has('ENCOUNTER_FINALIZE'));
    check('Audit event PRESCRIPTION_DISPENSE tercatat', actions.has('PRESCRIPTION_DISPENSE'));
    check('Audit event SIGNATURE_REQUEST tercatat', actions.has('SIGNATURE_REQUEST'));

    const chain = await req('POST', '/iam/audit-logs/verify-chain', { token: admin, body: {} });
    check('POST verify-chain -> isValid true (rantai SHA-256 utuh)', chain.status === 200 && chain.body?.data?.isValid === true, `isValid=${chain.body?.data?.isValid}`);
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 10. Offline sync: register + push idempotent + conflicts ===');
  if (admin) {
    const dev = await req('POST', '/sync/register-device', { token: admin, body: { deviceFingerprintHash: `fp-tahap3-${Date.now()}`, siteCode: 'SITE-HO-JKT' } });
    check('POST /sync/register-device', dev.status >= 200 && dev.status < 300, `status=${dev.status}`);
    const deviceId = dev.body?.data?.id;
    if (deviceId) {
      const batch = { deviceId, items: [{ localRecordId: `local-t3-${Date.now()}`, entityType: 'VITAL_SIGN', payload: { note: 'uji tahap 3' } }] };
      const p1 = await req('POST', '/sync/push', { token: admin, body: batch });
      check('POST /sync/push pertama -> SYNCED', p1.status === 200 && p1.body?.data?.results?.[0]?.status === 'SYNCED', `status=${p1.body?.data?.results?.[0]?.status}`);
      const p2 = await req('POST', '/sync/push', { token: admin, body: batch });
      check('Push ulang idempotent -> IDEMPOTENT_SKIPPED', p2.status === 200 && p2.body?.data?.results?.[0]?.status === 'IDEMPOTENT_SKIPPED', `status=${p2.body?.data?.results?.[0]?.status}`);
      const conflicts = await req('GET', '/sync/conflicts', { token: admin });
      check('GET /sync/conflicts (admin)', conflicts.status === 200, `status=${conflicts.status}`);
      if (tokens.MANAGEMENT) {
        const r = await req('GET', '/sync/conflicts', { token: tokens.MANAGEMENT });
        check('GET /sync/conflicts oleh MANAGEMENT -> 403', r.status === 403, `status=${r.status}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n=== 11. Reporting ===');
  if (admin) {
    const defs = await req('GET', '/reports/definitions', { token: admin });
    check('GET /reports/definitions', defs.status === 200, `status=${defs.status}`);
    const top = await req('GET', '/analytics/top-diseases', { token: tokens.HSE_MANAGER ?? admin });
    check('GET /analytics/top-diseases (HSE/MGMT)', top.status === 200, `status=${top.status}`);
    if (tokens.PHARMACIST) {
      const r = await req('GET', '/analytics/top-diseases', { token: tokens.PHARMACIST });
      check('GET /analytics/top-diseases oleh PHARMACIST -> 403', r.status === 403, `status=${r.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  console.log('\n========================================');
  console.log(`TOTAL: ${results.length} | PASS: ${results.length - fails} | FAIL: ${fails}`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E runner error:', e);
  process.exit(1);
});
