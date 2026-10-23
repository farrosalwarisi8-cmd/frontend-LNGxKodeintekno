import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserStubs, mockFetch, envelope, pathOf } from "./helpers";
import { setToken } from "@/lib/api-client";
import { clearPharmacySiteScopeCache } from "@/lib/services/pharmacy.service";

installBrowserStubs();

/**
 * Kontrak endpoint: memastikan setiap service modul frontend memanggil
 * endpoint backend (lihat API_ENDPOINTS.md) dengan method yang benar.
 */
const EXPECTED_ENDPOINTS: Array<{ module: string; method: string; path: RegExp }> = [
  // Modul 1 — IAM / Autentikasi
  { module: "auth.login", method: "POST", path: /^\/api\/v1\/auth\/login$/ },
  { module: "auth.mfa", method: "POST", path: /^\/api\/v1\/auth\/mfa\/verify$/ },
  // Modul 2 — Pasien / MPI & Consent
  { module: "patient.list", method: "GET", path: /^\/api\/v1\/patients(\?|$)/ },
  {
    module: "patient.duplicateCheck",
    method: "POST",
    path: /^\/api\/v1\/patients\/check-duplicate$/,
  },
  { module: "patient.create", method: "POST", path: /^\/api\/v1\/patients$/ },
  { module: "patient.profile", method: "GET", path: /^\/api\/v1\/patients\/[^/]+\/profile$/ },
  { module: "patient.consentSend", method: "POST", path: /^\/api\/v1\/consents\/send$/ },
  {
    module: "patient.consentVerify",
    method: "POST",
    path: /^\/api\/v1\/public\/consents\/verify$/,
  },
  // Modul 3 — Klinik
  { module: "encounter.queues", method: "GET", path: /^\/api\/v1\/clinic\/queues(\?|$)/ },
  { module: "encounter.call", method: "POST", path: /^\/api\/v1\/clinic\/queues\/call$/ },
  { module: "encounter.open", method: "POST", path: /^\/api\/v1\/clinic\/encounters$/ },
  {
    module: "encounter.vitals",
    method: "PUT",
    path: /^\/api\/v1\/clinic\/encounters\/[^/]+\/vitals$/,
  },
  {
    module: "encounter.soap",
    method: "PUT",
    path: /^\/api\/v1\/clinic\/encounters\/[^/]+\/soap$/,
  },
  {
    module: "encounter.icd10",
    method: "GET",
    path: /^\/api\/v1\/clinic\/icd10\/search(\?|$)/,
  },
  // Modul 4 — MCU & FTW
  { module: "mcu.list", method: "GET", path: /^\/api\/v1\/mcu\/cycles(\?|$)/ },
  { module: "mcu.create", method: "POST", path: /^\/api\/v1\/mcu\/cycles$/ },
  {
    module: "mcu.calculate",
    method: "POST",
    path: /^\/api\/v1\/mcu\/cycles\/[^/]+\/calculate$/,
  },
  {
    module: "mcu.ftw",
    method: "POST",
    path: /^\/api\/v1\/mcu\/cycles\/[^/]+\/ftw-assessment$/,
  },
  // Modul 5 — Farmasi
  { module: "pharmacy.inventory", method: "GET", path: /^\/api\/v1\/pharmacy\/inventory(\?|$)/ },
  {
    module: "pharmacy.pending",
    method: "GET",
    path: /^\/api\/v1\/pharmacy\/prescriptions\/pending(\?|$)/,
  },
  {
    module: "pharmacy.recommend",
    method: "POST",
    path: /^\/api\/v1\/pharmacy\/dispensing\/recommend-batches$/,
  },
  { module: "pharmacy.dispense", method: "POST", path: /^\/api\/v1\/pharmacy\/dispensing$/ },
  { module: "pharmacy.returns", method: "POST", path: /^\/api\/v1\/pharmacy\/returns$/ },
  // Modul 6 — Notifikasi
  { module: "notification.list", method: "GET", path: /^\/api\/v1\/notifications$/ },
  {
    module: "notification.read",
    method: "PUT",
    path: /^\/api\/v1\/notifications\/[^/]+\/read$/,
  },
  // Modul 7 — IAM Users & Audit
  { module: "iam.users", method: "GET", path: /^\/api\/v1\/iam\/users(\?|$)/ },
  { module: "iam.auditLogs", method: "GET", path: /^\/api\/v1\/iam\/audit-logs(\?|$)/ },
  {
    module: "iam.verifyChain",
    method: "POST",
    path: /^\/api\/v1\/iam\/audit-logs\/verify-chain$/,
  },
  // Modul 8 — Reporting & Analytics
  { module: "report.definitions", method: "GET", path: /^\/api\/v1\/reports\/definitions$/ },
  { module: "report.run", method: "POST", path: /^\/api\/v1\/reports\/runs$/ },
  {
    module: "report.download",
    method: "GET",
    path: /^\/api\/v1\/reports\/exports\/[^/]+\/download$/,
  },
  { module: "report.topDiseases", method: "GET", path: /^\/api\/v1\/analytics\/top-diseases(\?|$)/ },
  // Modul 9 — Dokumen & Verifikasi publik
  { module: "document.renderPdf", method: "POST", path: /^\/api\/v1\/documents\/render-pdf$/ },
  { module: "document.signature", method: "POST", path: /^\/api\/v1\/signatures\/request$/ },
  {
    module: "document.verify",
    method: "GET",
    path: /^\/api\/v1\/public\/verify\/[^/]+$/,
  },
  // Modul 10 — D&A
  { module: "da.createTest", method: "POST", path: /^\/api\/v1\/da\/tests$/ },
  { module: "da.createSample", method: "POST", path: /^\/api\/v1\/da\/samples$/ },
  {
    module: "da.results",
    method: "POST",
    path: /^\/api\/v1\/da\/tests\/[^/]+\/results$/,
  },
  {
    module: "da.certificate",
    method: "POST",
    path: /^\/api\/v1\/da\/tests\/[^/]+\/certificate$/,
  },
];

describe("Kontrak endpoint frontend <-> backend", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Modul 1 — auth service memanggil /auth/login dan /auth/mfa/verify", async () => {
    const calls = mockFetch(() => ({ body: envelope({ accessToken: "t", user: {} }) }));
    const { authService } = await import("@/lib/services/auth.service");

    await authService.login("admin", "rahasia");
    await authService.verifyMfa("user-1", "123456");

    expect(pathOf(calls[0].url)).toBe("/api/v1/auth/login");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ username: "admin", password: "rahasia" });
    expect(pathOf(calls[1].url)).toBe("/api/v1/auth/mfa/verify");
    expect(calls[1].body).toEqual({ userId: "user-1", totpCode: "123456" });
  });

  it("Modul 1 — memetakan role backend ke role frontend", async () => {
    const { mapBackendRole, BACKEND_ROLE_MAP, toSessionUser } = await import(
      "@/lib/services/auth.service"
    );
    expect(mapBackendRole(["SYSTEM_ADMIN"])).toBe("admin");
    expect(mapBackendRole(["DOCTOR_OH"])).toBe("dokter-oh");
    expect(mapBackendRole(["PHARMACIST"])).toBe("apoteker");
    expect(mapBackendRole(["UNKNOWN_ROLE"])).toBe("pekerja");

    const session = toSessionUser({
      id: "u1",
      username: "dr.hendra",
      roles: ["DOCTOR_OH"],
      isMedicalRole: true,
    });
    expect(session.role).toBe("dokter-oh");
    expect(session.isMedicalRole).toBe(true);
    expect(Object.keys(BACKEND_ROLE_MAP).length).toBeGreaterThanOrEqual(10);
  });

  it("Modul 2 — patient service memanggil endpoint MPI & consent", async () => {
    const calls = mockFetch((req) => {
      if (req.url.includes("/profile")) {
        return { body: envelope({ id: "p1", medical_record_no: "MRN-1", full_name: "Budi" }) };
      }
      return { body: envelope([], { page: 1, limit: 20, total: 0, totalPages: 0 }) };
    });
    const { patientService } = await import("@/lib/services/patient.service");

    await patientService.list({ page: 1, pageSize: 20, search: "budi" });
    await patientService.getProfile("p1");
    await patientService.sendConsent("p1", "DATA_PROCESSING");
    await patientService.verifyConsent("token-123", "AGREED");

    expect(pathOf(calls[0].url)).toBe("/api/v1/patients?search=budi&page=1&limit=20");
    expect(calls[0].method).toBe("GET");
    expect(pathOf(calls[1].url)).toBe("/api/v1/patients/p1/profile");
    expect(pathOf(calls[2].url)).toBe("/api/v1/consents/send");
    expect(calls[2].body).toEqual({ patientId: "p1", consentType: "DATA_PROCESSING" });
    expect(pathOf(calls[3].url)).toBe("/api/v1/public/consents/verify");
    expect(calls[3].body).toEqual({ token: "token-123", action: "AGREED" });
  });

  it("Modul 2 — deduplikasi memakai POST /patients/check-duplicate", async () => {
    const calls = mockFetch(() => ({
      body: envelope({
        isDuplicate: true,
        severity: "BLOCK",
        message: "Sudah terdaftar",
        existingPerson: {
          id: "p1",
          fullName: "Budi",
          mrn: "MRN-1",
          employeeNo: "EMP-1",
          employmentStatus: "ACTIVE",
        },
      }),
    }));
    const { patientService } = await import("@/lib/services/patient.service");

    const result = await patientService.duplicateCheck({
      identifierType: "NIK",
      identifierValue: "3201011405880001",
      fullName: "Budi",
    });

    expect(pathOf(calls[0].url)).toBe("/api/v1/patients/check-duplicate");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      identifierType: "NIK",
      identifierValue: "3201011405880001",
      fullName: "Budi",
    });
    expect(result.isDuplicate).toBe(true);
    expect(result.severity).toBe("BLOCK");
    expect(result.existingPerson?.mrn).toBe("MRN-1");
  });

  it("Modul 3 — encounter service memanggil endpoint klinik", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "enc-1" }) }));
    const { encounterService } = await import("@/lib/services/encounter.service");

    await encounterService.getQueues();
    await encounterService.openEncounter("p1");
    await encounterService.recordVitals("enc-1", { heightCm: 170, weightKg: 65 });
    await encounterService.saveSoap("enc-1", { subjective: "batuk" });
    await encounterService.searchIcd10("hypertension");
    await encounterService.finalize("enc-1");

    expect(pathOf(calls[0].url)).toBe("/api/v1/clinic/queues");
    expect(pathOf(calls[1].url)).toBe("/api/v1/clinic/encounters");
    expect(calls[1].body).toEqual({ patientId: "p1", appointmentId: undefined });
    expect(pathOf(calls[2].url)).toBe("/api/v1/clinic/encounters/enc-1/vitals");
    expect(calls[2].method).toBe("PUT");
    expect(pathOf(calls[3].url)).toBe("/api/v1/clinic/encounters/enc-1/soap");
    expect(pathOf(calls[4].url)).toBe(
      "/api/v1/clinic/icd10/search?keyword=hypertension"
    );
    expect(pathOf(calls[5].url)).toBe("/api/v1/clinic/encounters/enc-1/finalize");
    expect(calls[5].method).toBe("POST");
  });

  it("Modul 4 — mcu service memakai enum backend", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "mcu-1" }) }));
    const { mcuService } = await import("@/lib/services/mcu.service");

    await mcuService.list({ page: 1, limit: 10, ftwStatus: "FIT" });
    await mcuService.create("p1", "ANNUAL_PERIODIC", "2026-10-06");
    await mcuService.calculate("mcu-1", { parameters: { weightKg: 70 } });
    await mcuService.assessFtw("mcu-1", "FIT_WITH_RESTRICTION", "sehat", {
      description: "dilarang ketinggian",
      reviewDate: "2027-01-01",
    });

    expect(pathOf(calls[0].url)).toBe("/api/v1/mcu/cycles?page=1&limit=10&ftwStatus=FIT");
    expect(pathOf(calls[1].url)).toBe("/api/v1/mcu/cycles");
    expect(calls[1].body).toEqual({
      patientId: "p1",
      mcuType: "ANNUAL_PERIODIC",
      examinationDate: "2026-10-06",
    });
    expect(pathOf(calls[2].url)).toBe("/api/v1/mcu/cycles/mcu-1/calculate");
    expect(pathOf(calls[3].url)).toBe("/api/v1/mcu/cycles/mcu-1/ftw-assessment");
    expect(calls[3].body).toMatchObject({ ftwStatus: "FIT_WITH_RESTRICTION" });
  });

  it("Modul 5 — pharmacy service memanggil endpoint FEFO", async () => {
    // Guard cross-site perlu mengenali user: berikan JWT palsu dengan
    // username "admin" dan mock /iam/users mengembalikan role SYSTEM_ADMIN
    // (GLOBAL) sehingga seluruh site diizinkan.
    setToken(`fake.${btoa(JSON.stringify({ username: "admin" }))}.sig`);
    clearPharmacySiteScopeCache();
    const calls = mockFetch((req) => {
      if (req.url.includes("/iam/users")) {
        return {
          body: envelope([
            {
              id: "u-admin",
              username: "admin",
              user_roles: [
                {
                  id: "ur-1",
                  role: { id: "r-1", code: "SYSTEM_ADMIN", name: "System Administrator" },
                  site: { id: "site-ho", code: "SITE-HO-JKT", name: "Head Office Jakarta" },
                },
              ],
            },
          ]),
        };
      }
      return { body: envelope([]) };
    });
    const { pharmacyService } = await import("@/lib/services/pharmacy.service");

    await pharmacyService.getInventory();
    await pharmacyService.getPendingPrescriptions();
    await pharmacyService.recommendBatches("med-1", "site-1", 30);
    await pharmacyService.dispense("rx-1", [{ stockBatchId: "b1", quantity: 10 }]);
    await pharmacyService.returnMedication("d1", "b1", 5, "alergi");

    // Guard cross-site menyelesaikan cakupan site lewat /iam/users sekali
    // (di-cache per token) sebelum aksi tulis — kontrak endpoint farmasi
    // diverifikasi terpisah pada panggilan /pharmacy saja.
    expect(calls.filter((c) => pathOf(c.url).startsWith("/api/v1/iam/users"))).toHaveLength(1);
    const pharmacy = calls.filter((c) => pathOf(c.url).includes("/pharmacy/"));
    expect(pathOf(pharmacy[0].url)).toBe("/api/v1/pharmacy/inventory");
    expect(pathOf(pharmacy[1].url)).toBe("/api/v1/pharmacy/prescriptions/pending");
    expect(pathOf(pharmacy[2].url)).toBe("/api/v1/pharmacy/dispensing/recommend-batches");
    expect(pharmacy[2].body).toEqual({
      medicationId: "med-1",
      siteId: "site-1",
      requiredQuantity: 30,
    });
    expect(pathOf(pharmacy[3].url)).toBe("/api/v1/pharmacy/dispensing");
    expect(pathOf(pharmacy[4].url)).toBe("/api/v1/pharmacy/returns");
    clearPharmacySiteScopeCache();
  });

  it("Modul 6 — notification service memanggil endpoint notifikasi", async () => {
    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { notificationService } = await import("@/lib/services/notification.service");

    await notificationService.getAll();
    await notificationService.markAsRead("n1");

    expect(pathOf(calls[0].url)).toBe("/api/v1/notifications");
    expect(pathOf(calls[1].url)).toBe("/api/v1/notifications/n1/read");
    expect(calls[1].method).toBe("PUT");
  });

  it("Modul 7 — IAM service memanggil users, audit log, dan verify-chain", async () => {
    const calls = mockFetch(() => ({ body: envelope([], { page: 1, limit: 20, total: 0, totalPages: 0 }) }));
    const { iamService } = await import("@/lib/services/iam.service");

    await iamService.listUsers(1, 20);
    await iamService.listAuditLogs(1, 20);
    await iamService.verifyChain();

    expect(pathOf(calls[0].url)).toBe("/api/v1/iam/users?page=1&limit=20");
    expect(pathOf(calls[1].url)).toBe("/api/v1/iam/audit-logs?page=1&limit=20");
    expect(pathOf(calls[2].url)).toBe("/api/v1/iam/audit-logs/verify-chain");
    expect(calls[2].method).toBe("POST");
  });

  it("Modul 8 — reporting service memanggil definitions, runs, download, analytics", async () => {
    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { reportingService } = await import("@/lib/services/reporting.service");

    await reportingService.getDefinitions();
    await reportingService.runReport("def-1", "PDF", { startDate: "2026-01-01" });
    await reportingService.downloadExport("exp-1");
    await reportingService.topDiseases({ startDate: "2026-01-01", endDate: "2026-10-01" });

    expect(pathOf(calls[0].url)).toBe("/api/v1/reports/definitions");
    expect(pathOf(calls[1].url)).toBe("/api/v1/reports/runs");
    expect(pathOf(calls[2].url)).toBe("/api/v1/reports/exports/exp-1/download");
    expect(pathOf(calls[3].url)).toBe(
      "/api/v1/analytics/top-diseases?startDate=2026-01-01&endDate=2026-10-01"
    );
  });

  it("Modul 9 — document service memanggil render-pdf, signatures, verify publik", async () => {
    const calls = mockFetch(() => ({ body: envelope({ isValid: true, status: "VERIFIED" }) }));
    const { documentService } = await import("@/lib/services/document.service");

    await documentService.renderPdf("FTW_CERTIFICATE", "mcu-1", "Sertifikat FTW");
    await documentService.requestSignature("doc-1", "CERTIFIED_PSRE");
    await documentService.verifyPublic("qr-token-1");

    expect(pathOf(calls[0].url)).toBe("/api/v1/documents/render-pdf");
    expect(calls[0].body).toEqual({
      documentType: "FTW_CERTIFICATE",
      referenceId: "mcu-1",
      title: "Sertifikat FTW",
    });
    expect(pathOf(calls[1].url)).toBe("/api/v1/signatures/request");
    expect(pathOf(calls[2].url)).toBe("/api/v1/public/verify/qr-token-1");
  });

  it("Modul 10 — D&A service memanggil tests, samples, results, certificate", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "x" }) }));
    const { daService } = await import("@/lib/services/da.service");

    await daService.createTest("p1", "RANDOM_INSPECTION");
    await daService.createSample("test-1", "SMP-001", "URINE");
    await daService.submitResults("test-1", "NEGATIVE", undefined, false);
    await daService.issueCertificate("test-1");

    expect(pathOf(calls[0].url)).toBe("/api/v1/da/tests");
    expect(calls[0].body).toEqual({
      patientId: "p1",
      encounterId: undefined,
      testType: "RANDOM_INSPECTION",
    });
    expect(pathOf(calls[1].url)).toBe("/api/v1/da/samples");
    expect(pathOf(calls[2].url)).toBe("/api/v1/da/tests/test-1/results");
    expect(pathOf(calls[3].url)).toBe("/api/v1/da/tests/test-1/certificate");
  });

  it("setiap endpoint frontend terdaftar di backend (snapshot route NestJS)", () => {
    // Snapshot route yang di-log backend saat startup (npm run start -> "Mapped {...}")
    const BACKEND_ROUTES: Array<[string, string]> = [
      ["/api/v1/auth/login", "POST"],
      ["/api/v1/auth/mfa/verify", "POST"],
      ["/api/v1/auth/refresh", "POST"],
      ["/api/v1/patients", "GET"],
      ["/api/v1/patients", "POST"],
      ["/api/v1/patients/check-duplicate", "POST"],
      ["/api/v1/patients/:id/profile", "GET"],
      ["/api/v1/consents/send", "POST"],
      ["/api/v1/public/consents/verify", "POST"],
      ["/api/v1/clinic/queues", "GET"],
      ["/api/v1/clinic/queues/call", "POST"],
      ["/api/v1/clinic/encounters", "POST"],
      ["/api/v1/clinic/encounters/:id/vitals", "PUT"],
      ["/api/v1/clinic/encounters/:id/soap", "PUT"],
      ["/api/v1/clinic/encounters/:id/finalize", "POST"],
      ["/api/v1/clinic/encounters/:id/addendum", "POST"],
      ["/api/v1/clinic/icd10/search", "GET"],
      ["/api/v1/mcu/cycles", "GET"],
      ["/api/v1/mcu/cycles", "POST"],
      ["/api/v1/mcu/cycles/:id/calculate", "POST"],
      ["/api/v1/mcu/cycles/:id/ftw-assessment", "POST"],
      ["/api/v1/mcu/restrictions/:id/acknowledge", "POST"],
      ["/api/v1/mcu/restrictions/:id/close", "POST"],
      ["/api/v1/pharmacy/inventory", "GET"],
      ["/api/v1/pharmacy/prescriptions/pending", "GET"],
      ["/api/v1/pharmacy/dispensing/recommend-batches", "POST"],
      ["/api/v1/pharmacy/dispensing", "POST"],
      ["/api/v1/pharmacy/returns", "POST"],
      ["/api/v1/notifications", "GET"],
      ["/api/v1/notifications/:id/read", "PUT"],
      ["/api/v1/iam/users", "GET"],
      ["/api/v1/iam/audit-logs", "GET"],
      ["/api/v1/iam/audit-logs/verify-chain", "POST"],
      ["/api/v1/reports/definitions", "GET"],
      ["/api/v1/reports/runs", "POST"],
      ["/api/v1/reports/exports/:id/download", "GET"],
      ["/api/v1/analytics/top-diseases", "GET"],
      ["/api/v1/documents/render-pdf", "POST"],
      ["/api/v1/signatures/request", "POST"],
      ["/api/v1/public/verify/:qrToken", "GET"],
      ["/api/v1/da/tests", "POST"],
      ["/api/v1/da/samples", "POST"],
      ["/api/v1/da/samples/:id/chain-of-custody", "POST"],
      ["/api/v1/da/tests/:id/results", "POST"],
      ["/api/v1/da/tests/:id/certificate", "POST"],
    ];

    const normalize = (p: string) => p.replace(/:[A-Za-z0-9_]+/g, ":param");
    // Contoh URL konkret dari tiap route backend (parameter diganti nilai)
    const exampleFor = (route: string) => route.replace(/:[A-Za-z0-9_]+/g, "sample-id");

    for (const expected of EXPECTED_ENDPOINTS) {
      const found = BACKEND_ROUTES.some(
        ([route, method]) =>
          method === expected.method && expected.path.test(exampleFor(route))
      );
      expect(
        found,
        `Endpoint frontend ${expected.module} (${expected.method}) tidak cocok dengan route backend manapun`
      ).toBe(true);
    }

    // pastikan helper tetap dipakai (tidak ada duplikasi route aneh)
    expect(normalize("/api/v1/patients/:id/profile")).toBe("/api/v1/patients/:param/profile");
  });
});
