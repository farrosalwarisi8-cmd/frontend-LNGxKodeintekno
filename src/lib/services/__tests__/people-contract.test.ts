import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserStubs, mockFetch, envelope, pathOf } from "./helpers";

/**
 * frontend-contract-test — memverifikasi kontrak service frontend terhadap
 * bentuk response backend yang NYATA (bukan mengklaim business flow sukses).
 *
 * Gap yang ditutup:
 *  - F2-C: consent memakai enum action backend (AGREED/DECLINED), bukan VIEW.
 *  - F2-D: daftar pekerja hanya mengirim parameter yang didukung API.
 *  - F2-E: MRN/ID berasal dari response backend, kegagalan consent tidak
 *          berubah menjadi success.
 */
installBrowserStubs();

const jwt = (payload: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64")}.signature`;

const SCOPE_USERS = [
  {
    id: "u-1",
    user_roles: [
      {
        org_unit_id: "ou-1",
        site_id: "site-1",
        site: { id: "site-1", code: "SITE-PLANT-01", name: "Plant 1" },
      },
    ],
  },
];

describe("frontend-contract-test — patientService", () => {
  beforeEach(async () => {
    localStorage.clear();
    (globalThis as unknown as { location: { href: string; origin?: string } }).location.origin =
      "http://frontend.test";
    const { setToken } = await import("@/lib/api-client");
    setToken(jwt({ organizationId: "org-1", sub: "u-1" }));
  });

  it("F2-D: list pekerja hanya mengirim page/limit/search (tidak ada filter yang tidak didukung)", async () => {
    const calls = mockFetch(() => ({ body: envelope([], { page: 1, limit: 10, total: 0, totalPages: 1 }) }));
    const { patientService } = await import("@/lib/services/patient.service");

    await patientService.list({ search: "BUDI", page: 2, pageSize: 10 });

    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/api/v1/patients");
    expect([...url.searchParams.keys()].sort()).toEqual(["limit", "page", "search"]);
    expect(url.searchParams.get("search")).toBe("BUDI");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("F2-D: tanpa pencarian tidak ada parameter search kosong", async () => {
    const calls = mockFetch(() => ({ body: envelope([], { page: 1, limit: 10, total: 0, totalPages: 1 }) }));
    const { patientService } = await import("@/lib/services/patient.service");

    await patientService.list({ page: 1, pageSize: 10 });
    expect(calls[0].url).not.toContain("search=");
    expect([...new URL(calls[0].url).searchParams.keys()].sort()).toEqual(["limit", "page"]);
  });

  it("F2-E: MRN berasal dari response backend (bukan dibuat frontend)", async () => {
    const calls = mockFetch((req) => {
      if (req.url.includes("/iam/users")) return { body: envelope(SCOPE_USERS) };
      if (pathOf(req.url) === "/api/v1/patients" && req.method === "POST") {
        return {
          body: envelope({
            id: "patient-1",
            medicalRecordNo: "MRN-SITE-PLANT-01-2026-00099",
            fullName: "Budi",
            employeeNo: "E2E-CT-1",
            maskedIdentifier: "****1234",
          }),
        };
      }
      if (req.url.includes("/consents/send")) {
        return {
          body: envelope({
            consentId: "consent-1",
            verificationToken: "tok-abc",
            message: "Consent dispatched",
          }),
        };
      }
      return { body: envelope({}) };
    });
    const { patientService } = await import("@/lib/services/patient.service");
    const { clearScope } = await import("@/lib/services/reference.service");
    clearScope();

    const result = await patientService.create({
      employeeNo: "E2E-CT-1",
      fullName: "Budi",
      birthDate: "1990-01-01",
      sex: "MALE",
      email: "budi@e2e-test.local",
      phone: "081200000000",
      identifierType: "NIK",
      identifierValue: "1234567890123456",
      consentType: "DATA_PROCESSING",
    } as never);

    expect(result.mrn).toBe("MRN-SITE-PLANT-01-2026-00099");
    expect(result.patientId).toBe("patient-1");
    expect(result.consentId).toBe("consent-1");
    expect(result.deliveryStatus).toBe("SIMULATED_SENT");
    expect(result.consentLink).toBe("http://frontend.test/public/consent/tok-abc");
    // Tidak ada MRN yang dibuat lokal
    expect(result.mrn).not.toMatch(/^MRN-\d{6}$/);

    const sendCall = calls.find((c) => c.url.includes("/consents/send"));
    expect(sendCall?.body).toEqual({ patientId: "patient-1", consentType: "DATA_PROCESSING" });
  });

  it("F2-E: kegagalan kirim consent TIDAK menjadi success (delivery gagal dilaporkan)", async () => {
    mockFetch((req) => {
      if (req.url.includes("/iam/users")) return { body: envelope(SCOPE_USERS) };
      if (pathOf(req.url) === "/api/v1/patients") {
        return {
          body: envelope({
            id: "patient-2",
            medicalRecordNo: "MRN-SITE-PLANT-01-2026-00100",
            fullName: "Siti",
            employeeNo: "E2E-CT-2",
            maskedIdentifier: "****5678",
          }),
        };
      }
      if (req.url.includes("/consents/send")) {
        return {
          status: 500,
          body: { success: false, statusCode: 500, message: "Consent dispatch failed" },
        };
      }
      return { body: envelope({}) };
    });
    const { patientService } = await import("@/lib/services/patient.service");
    const { clearScope } = await import("@/lib/services/reference.service");
    clearScope();

    const result = await patientService.create({
      employeeNo: "E2E-CT-2",
      fullName: "Siti",
      birthDate: "1991-01-01",
      sex: "FEMALE",
      email: "siti@e2e-test.local",
      phone: "081200000001",
      identifierType: "NIK",
      identifierValue: "1234567890123457",
      consentType: "DATA_PROCESSING",
    } as never);

    expect(result.deliveryStatus).toBe("SIMULATED_FAILED");
    expect(result.consentStatus).toBe("DELIVERY_FAILED");
    expect(result.deliveryError).toMatch(/consent/i);
    expect(result.consentLink).toBe("");
  });

  it("F2-C: verify consent publik mengirim action enum backend, bukan VIEW", async () => {
    const calls = mockFetch(() => ({
      body: envelope({ status: "SUCCESS", consentStatus: "GRANTED" }),
    }));
    const { patientService } = await import("@/lib/services/patient.service");

    const granted = await patientService.verifyConsent("tok-1", "AGREED");
    expect(granted.status).toBe("APPROVED");
    expect(calls[0].body).toEqual({ token: "tok-1", action: "AGREED" });
    expect(JSON.stringify(calls[0].body)).not.toContain("VIEW");
  });

  it("F2-C: keputusan DECLINED dipetakan ke status REJECTED", async () => {
    mockFetch(() => ({ body: envelope({ status: "SUCCESS", consentStatus: "REVOKED" }) }));
    const { patientService } = await import("@/lib/services/patient.service");
    const res = await patientService.verifyConsent("tok-2", "DECLINED");
    expect(res.status).toBe("REJECTED");
  });

  it("F2-C: kegagalan verify consent tetap melempar error (tidak diubah jadi sukses)", async () => {
    mockFetch(() => ({
      status: 400,
      body: { success: false, statusCode: 400, message: "Consent token already used" },
    }));
    const { patientService } = await import("@/lib/services/patient.service");
    await expect(patientService.verifyConsent("tok-3", "AGREED")).rejects.toThrow(/already used/i);
  });
});
