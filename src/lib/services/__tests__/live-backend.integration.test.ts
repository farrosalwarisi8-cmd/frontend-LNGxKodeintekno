import { beforeAll, describe, expect, it } from "vitest";
import { installBrowserStubs } from "./helpers";

/**
 * Integrasi live frontend -> backend.
 *
 * Test ini berjalan otomatis hanya jika backend NestJS sudah hidup di
 * http://localhost:3000 (jalankan: npm run start:dev di folder backend).
 * Set LIVE_API=0 untuk memaksa melewati test ini.
 *
 * Mencakup Modul 1..10 yang sudah dihubungkan ke backend.
 *
 * Gap F1-D: target backend diambil dari `TEST_API_URL`/`E2E_API_URL` lebih dulu
 * (eksplisit) supaya test tidak bergantung pada `.env.local` developer.
 */
const BASE =
  process.env.TEST_API_URL ??
  process.env.E2E_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000/api/v1";

installBrowserStubs();

/**
 * Deteksi backend yang tahan terhadap "port 3000 dipakai dev server frontend":
 * probe mensyaratkan HTTP 200 **dan** body JSON milik backend. Dev server
 * frontend membalas redirect ke /login (HTML), sehingga TIDAK dianggap backend —
 * integrasi live lalu dilewati, bukan gagal palsu (gap F1-D).
 */
const LIVE =
  process.env.LIVE_API !== "0" &&
  (await fetch(`${BASE.replace(/\/api\/v1$/, "")}/health/liveness`, { method: "GET" })
    .then(async (r) => {
      if (!r.ok) return false;
      const body = (await r.json().catch(() => null)) as
        | { status?: unknown; data?: { status?: unknown } }
        | null;
      // Envelope backend: { success, data: { status: "UP" } }
      const status = body?.data?.status ?? body?.status;
      return typeof status === "string";
    })
    .catch(() => false));

console.log(
  LIVE
    ? `[live-backend] backend terdeteksi di ${BASE} — menjalankan integrasi nyata`
    : "[live-backend] backend tidak terjangkau — integrasi dilewati"
);

let apiClient: (typeof import("@/lib/api-client"))["apiClient"];
let authService: (typeof import("@/lib/services/auth.service"))["authService"];
let patientService: (typeof import("@/lib/services/patient.service"))["patientService"];
let encounterService: (typeof import("@/lib/services/encounter.service"))["encounterService"];
let mcuService: (typeof import("@/lib/services/mcu.service"))["mcuService"];
let pharmacyService: (typeof import("@/lib/services/pharmacy.service"))["pharmacyService"];
let notificationService: (typeof import("@/lib/services/notification.service"))["notificationService"];
let iamService: (typeof import("@/lib/services/iam.service"))["iamService"];
let reportingService: (typeof import("@/lib/services/reporting.service"))["reportingService"];
let documentService: (typeof import("@/lib/services/document.service"))["documentService"];
let daService: (typeof import("@/lib/services/da.service"))["daService"];
let referenceService: typeof import("@/lib/services/reference.service");

const created = {
  patientId: "",
  encounterId: "",
  mcuId: "",
  documentId: "",
  qrToken: "",
  daTestId: "",
  daSampleId: "",
};

describe.runIf(LIVE)("Integrasi live backend (Modul 1-10)", () => {
  beforeAll(async () => {
    process.env.TEST_API_URL = BASE;
    process.env.NEXT_PUBLIC_API_URL = BASE;
    const client = await import("@/lib/api-client");
    apiClient = client.apiClient;
    authService = (await import("@/lib/services/auth.service")).authService;
    patientService = (await import("@/lib/services/patient.service")).patientService;
    encounterService = (await import("@/lib/services/encounter.service")).encounterService;
    mcuService = (await import("@/lib/services/mcu.service")).mcuService;
    pharmacyService = (await import("@/lib/services/pharmacy.service")).pharmacyService;
    notificationService = (await import("@/lib/services/notification.service")).notificationService;
    iamService = (await import("@/lib/services/iam.service")).iamService;
    reportingService = (await import("@/lib/services/reporting.service")).reportingService;
    documentService = (await import("@/lib/services/document.service")).documentService;
    daService = (await import("@/lib/services/da.service")).daService;
    referenceService = await import("@/lib/services/reference.service");
  });

  it("Modul 1 — login admin dan menerima JWT + role", async () => {
    const { setToken, setRefreshToken } = await import("@/lib/api-client");
    // Password seed disamakan untuk semua akun uji dev/staging (lihat prisma/seed.ts)
    const res = await authService.login("admin", "KlinikLNG2026!");

    // Kebijakan backend mewajibkan MFA untuk SYSTEM_ADMIN/DOCTOR_OH. Pada
    // deployment demo (NODE_ENV != production) backend mengizinkan bypass OTP
    // `123456` lewat `/auth/mfa/verify`, sehingga alur MFA di bawah adalah
    // jalur resmi yang juga dipakai UI, bukan shortcut palsu.
    let accessToken = res.accessToken ?? "";
    let refreshToken = res.refreshToken ?? "";

    if (!accessToken && res.mfaRequired && res.userId) {
      const verify = await authService.verifyMfa(res.userId, "123456");
      accessToken = verify.accessToken ?? "";
      refreshToken = verify.refreshToken ?? "";
    }

    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    setToken(accessToken);
    setRefreshToken(refreshToken);

    // Roles dibaca dari JWT yang benar-benar diterbitkan backend.
    const { decodeJwtPayload } = await import("@/lib/api-client");
    const payload = decodeJwtPayload(accessToken);
    expect(payload?.roles).toContain("SYSTEM_ADMIN");
  });

  it("Modul 1 — refresh token menghasilkan access token baru", async () => {
    const { setToken, getRefreshToken } = await import("@/lib/api-client");
    const res = await authService.refreshToken(getRefreshToken() ?? "");
    const accessToken = res.accessToken ?? "";
    expect(accessToken).toBeTruthy();
    setToken(accessToken);
  });

  it("Modul 7 — /iam/users mengembalikan akun admin", async () => {
    const users = await iamService.listUsers(1, 10);
    expect(users.data.length).toBeGreaterThan(0);
    expect(users.data[0].username).toBeTruthy();
    expect(users.meta?.total).toBeGreaterThanOrEqual(users.data.length);
  });

  it("Modul 7 — GET /iam/users/:id mengembalikan detail akun (Tahap 3)", async () => {
    const list = await iamService.listUsers(1, 10);
    expect(list.data.length).toBeGreaterThan(0);
    const first = list.data[0];

    const detail = await iamService.getUser(first.id);
    expect(detail.id).toBe(first.id);
    expect(detail.username).toBe(first.username);
  });

  it("Modul 7 — create/update user ditolak eksplisit (route belum ada di backend)", async () => {
    // Backend `iam/users` hanya read-only + unlock. Test ini mengunci kontrak:
    // bila backend kelak menambah POST/PATCH, test ini gagal dan harus
    // diperbarui bersama mapper UI — bukan diam-diam lolos.
    await expect(
      iamService.createUser({
        username: `live.uji.${Date.now()}`,
        email: `live.uji.${Date.now()}@layargas.co.id`,
        password: "LiveUjiTahap3!",
        roleCode: "NURSE",
      })
    ).rejects.toThrow(/belum tersedia di backend/i);

    await expect(
      iamService.updateUser("00000000-0000-0000-0000-000000000000", { active: false })
    ).rejects.toThrow(/belum tersedia di backend/i);
  });

  it("Modul 7 — POST /iam/users/:id/unlock tersedia (route backend nyata)", async () => {
    const list = await iamService.listUsers(1, 1);
    const target = list.data[0];
    expect(target?.id).toBeTruthy();
    // Unlock akun yang tidak terkunci tetap sukses idempoten di backend.
    const res = await iamService.unlockUser(target.id);
    expect(res.success).toBe(true);
  });

  it("Modul 11 — offline sync: register device + push idempotent (Tahap 3)", async () => {
    const device = await apiClient.post<{ id: string }>("/sync/register-device", {
      deviceFingerprintHash: `fp-live-${Date.now()}`,
      siteCode: "SITE-HO-JKT",
    });
    expect(device.id).toBeTruthy();

    const localId = `live-${Date.now()}`;
    const batch = {
      deviceId: device.id,
      items: [{ localRecordId: localId, entityType: "EMERGENCY_NOTE", payload: { note: "live" } }],
    };
    const first = await apiClient.post<{ results: Array<{ status: string }> }>("/sync/push", batch);
    expect(first.results[0]?.status).toBe("SYNCED");

    const second = await apiClient.post<{ results: Array<{ status: string }> }>("/sync/push", batch);
    expect(second.results[0]?.status).toBe("IDEMPOTENT_SKIPPED");
  });

  it("Modul 2 — registrasi pasien baru menghasilkan MRN", async () => {
    const scope = await referenceService.resolveScope();
    expect(scope.organizationId).toBeTruthy();
    expect(scope.siteId).toBeTruthy();

    const stamp = Date.now();
    const createdPatient = await apiClient.post<{
      id: string;
      medicalRecordNo: string;
      fullName: string;
      employeeNo: string;
    }>("/patients", {
      employeeNo: `EMP-T-${stamp}`,
      fullName: "Pasien Integrasi Automated",
      birthDate: "1990-05-14",
      sex: "M",
      email: `integration.${stamp}@layargas.co.id`,
      phone: "+628123000111",
      organizationId: scope.organizationId,
      orgUnitId: scope.orgUnitId,
      siteId: scope.siteId,
      siteCode: scope.siteCode,
      identifierType: "NIK",
      identifierValue: `320101140588${String(stamp).slice(-4)}`,
    });
    expect(createdPatient.medicalRecordNo).toMatch(/^MRN-/);
    created.patientId = createdPatient.id;
  });

  it("Modul 2 — daftar pasien & profil menampilkan data yang baru dibuat", async () => {
    const list = await patientService.list({ page: 1, pageSize: 50, search: "Integrasi" });
    expect(list.data.some((p) => p.id === created.patientId)).toBe(true);

    const profile = await patientService.getProfile(created.patientId);
    expect(profile.mrn).toMatch(/^MRN-/);
    expect(profile.fullName).toBe("Pasien Integrasi Automated");
    expect(profile.employeeNo).toBeTruthy();
  });

  it("Modul 2 — duplikat terdeteksi lewat pencarian identifier", async () => {
    const dup = await patientService.duplicateCheck({
      identifierType: "NIK",
      identifierValue: "tidak-ada-9999",
      fullName: "Tidak Ada",
    });
    expect(dup.isDuplicate).toBe(false);
  });

  it("Modul 3 — buka encounter, catat TTV, simpan SOAP, finalize", async () => {
    const encounter = await encounterService.openEncounter(created.patientId);
    expect(encounter.id).toBeTruthy();
    expect(encounter.patient_id).toBe(created.patientId);
    created.encounterId = encounter.id;

    const vitals = await encounterService.recordVitals(encounter.id, {
      heightCm: 171,
      weightKg: 72,
      systolicBp: 122,
      diastolicBp: 80,
      pulse: 76,
      temperature: 36.6,
      spo2: 99,
    });
    expect(Number(vitals.bmi)).toBeGreaterThan(0);

    const soap = await encounterService.saveSoap(encounter.id, {
      subjective: "Batuk ringan 2 hari",
      objective: "Faring hiperemis ringan",
      assessment: "ISPA ringan",
      plan: "Istirahat, hidrasi cukup",
      primaryIcd10: "J06.9",
    });
    expect(soap.encounter_id).toBe(encounter.id);

    const finalized = await encounterService.finalize(encounter.id);
    expect(finalized.status).toBe("LOCKED");
  });

  it("Modul 3 — pencarian ICD-10 mengembalikan katalog backend", async () => {
    const rows = await encounterService.searchIcd10("hypertension");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].code).toBeTruthy();
  });

  it("Modul 3 — antrean klinik bisa dibaca", async () => {
    const queues = await encounterService.getQueues();
    expect(Array.isArray(queues)).toBe(true);
  });

  it("Modul 4 — siklus MCU dibuat, dihitung, lalu dinilai FTW", async () => {
    const cycle = await mcuService.create(
      created.patientId,
      "ANNUAL_PERIODIC",
      new Date().toISOString().slice(0, 10)
    );
    expect(cycle.id).toBeTruthy();
    created.mcuId = cycle.id;

    const calc = await mcuService.calculate(cycle.id, {
      parameters: { weightKg: 72, heightCm: 171, systolicBp: 145, diastolicBp: 92 },
    });
    expect(calc).toBeTruthy();

    const result = await mcuService.assessFtw(cycle.id, "FIT", "Laik kerja tanpa restriksi");
    expect(result.assessment.ftw_status).toBe("FIT");

    // Data uji menumpuk antar run sehingga total siklus melebihi satu halaman
    // (page 1 berisi siklus TERLAMA, bukan yang baru dibuat). Telusuri semua
    // halaman sampai ketemu — assertion tetap sama: siklus + FTW assessment
    // harus terbaca dari backend.
    const firstPage = await mcuService.list({ page: 1, limit: 50 });
    const totalPages = firstPage.meta?.totalPages ?? 1;
    let found = firstPage.data.find((c) => c.id === cycle.id);
    for (let page = 2; !found && page <= totalPages; page++) {
      const next = await mcuService.list({ page, limit: 50 });
      found = next.data.find((c) => c.id === cycle.id);
    }
    expect(found).toBeTruthy();
    expect(found?.ftw_assessment).toBeTruthy();
  });

  it("Modul 5 — inventaris farmasi dan resep pending terbaca", async () => {
    const inventory = await pharmacyService.getInventory();
    expect(Array.isArray(inventory)).toBe(true);
    const pending = await pharmacyService.getPendingPrescriptions();
    expect(Array.isArray(pending)).toBe(true);
  });

  it("Modul 6 — notifikasi user terbaca", async () => {
    const notifications = await notificationService.getAll();
    expect(Array.isArray(notifications)).toBe(true);
  });

  it("Modul 7 — audit log tercatat dan rantai hash terverifikasi", async () => {
    const logs = await iamService.listAuditLogs(1, 20);
    expect(Array.isArray(logs.data)).toBe(true);

    const chain = await iamService.verifyChain();
    expect(chain).toBeTruthy();
    expect(typeof chain.isValid).toBe("boolean");
    expect(chain.isValid).toBe(true);
  });

  it("Modul 8 — definisi laporan, menjalankan report, dan analytics", async () => {
    const definitions = await reportingService.getDefinitions();
    expect(Array.isArray(definitions)).toBe(true);

    const analytics = await reportingService.topDiseases({
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: new Date().toISOString().slice(0, 10),
    });
    expect(analytics).toBeTruthy();
    expect(analytics.totalSampledCases).toBeGreaterThanOrEqual(0);
  });

  it("Modul 9 — render PDF dokumen + QR token bisa diverifikasi publik", async () => {
    const doc = await documentService.renderPdf(
      "FTW_CERTIFICATE",
      created.mcuId || "reference",
      "Sertifikat Integrasi Automated"
    );
    expect(doc.documentId).toBeTruthy();
    expect(doc.qrToken).toBeTruthy();
    created.documentId = doc.documentId;
    created.qrToken = doc.qrToken;

    const verify = await documentService.verifyPublic(doc.qrToken);
    expect(verify.isValid).toBe(true);
    expect(verify.status).toBe("VERIFIED");
    expect(verify.documentTitle).toBe("Sertifikat Integrasi Automated");
    // zero medical disclosure — tidak ada field diagnosis/medication
    expect(JSON.stringify(verify)).not.toMatch(/diagnos|medication|soap/i);
  });

  it("Modul 9 — token verifikasi yang tidak dikenal ditolak", async () => {
    const verify = await documentService.verifyPublic("token-tidak-ada-123");
    expect(verify.isValid).toBe(false);
  });

  it("Modul 10 — tes D&A: daftarkan tes, spesimen, hasil, dan sertifikat", async () => {
    const test = await daService.createTest(created.patientId, "RANDOM_INSPECTION");
    expect(test.id).toBeTruthy();
    created.daTestId = test.id;

    const sample = await daService.createSample(
      test.id,
      `SMP-IT-${Date.now()}`,
      "URINE"
    );
    expect(sample.id).toBeTruthy();
    created.daSampleId = sample.id;

    const result = await daService.submitResults(test.id, "NEGATIVE", "NEGATIVE", true);
    expect(result).toBeTruthy();

    const certificate = await daService.issueCertificate(test.id);
    expect(certificate).toBeTruthy();
  });
});
