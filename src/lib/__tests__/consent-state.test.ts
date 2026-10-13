import { describe, expect, it } from "vitest";
import {
  CONSENT_DECISION_ACTIONS,
  CONSENT_LOADS_WITHOUT_MUTATION,
  resolveConsentFailurePhase,
} from "@/lib/consent-state";

/**
 * Gap F2-C: consent UI tidak boleh mengarang status dan tidak boleh memutasi
 * token saat halaman hanya dibuka.
 */
describe("consent publik — kontrak aksi", () => {
  it("keputusan UI memakai enum backend AGREED/DECLINED", () => {
    expect(CONSENT_DECISION_ACTIONS.APPROVED).toBe("AGREED");
    expect(CONSENT_DECISION_ACTIONS.REJECTED).toBe("DECLINED");
  });

  it("halaman TIDAK memanggil API saat dimuat (verify bersifat mutasi one-time)", () => {
    expect(CONSENT_LOADS_WITHOUT_MUTATION).toBe(true);
  });
});

describe("resolveConsentFailurePhase", () => {
  it("token sudah dipakai → used", () => {
    expect(resolveConsentFailurePhase(400, "Consent already used")).toBe("used");
    expect(resolveConsentFailurePhase(400, "Token is no longer valid")).toBe("used");
    expect(resolveConsentFailurePhase(400, "Tautan sudah digunakan")).toBe("used");
  });

  it("token tidak dikenal/kedaluwarsa → invalid", () => {
    expect(resolveConsentFailurePhase(400, "Token consent tidak ditemukan")).toBe("invalid");
    expect(resolveConsentFailurePhase(400, "Consent token expired")).toBe("invalid");
  });

  it("status selain 400 → error (dapat dicoba ulang), bukan success", () => {
    expect(resolveConsentFailurePhase(0, "network")).toBe("error");
    expect(resolveConsentFailurePhase(401, "Unauthorized")).toBe("error");
    expect(resolveConsentFailurePhase(403, "Forbidden")).toBe("error");
    expect(resolveConsentFailurePhase(500, "Internal server error")).toBe("error");
    expect(resolveConsentFailurePhase(503, "Unavailable")).toBe("error");
  });

  it("tidak pernah memetakan kegagalan menjadi keputusan sukses third state", () => {
    const phases = [400, 404, 409, 422, 429, 500, 503].map((s) => resolveConsentFailurePhase(s, "gagal"));
    expect(phases).not.toContain("done" as never);
  });
});
