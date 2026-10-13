import { describe, expect, it } from "vitest";
import { errorKindForStatus, mapApiError, safeErrorMessage } from "@/lib/error-mapping";

/**
 * Gap F1-E / F2-F: pemetaan error frontend yang konsisten.
 * Acceptance: 401 bersihkan sesi, 403 AccessDenied, 404 ErrorState,
 * 409/422 field/modal, 500/503 server unavailable, 429 retry.
 */
describe("errorKindForStatus", () => {
  const cases: Array<[number, string]> = [
    [0, "offline"],
    [400, "validation"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [422, "validation"],
    [429, "rate-limit"],
    [500, "server"],
    [502, "server"],
    [503, "unavailable"],
    [504, "server"],
    [418, "unknown"],
  ];

  it.each(cases)("status %i → %s", (status, kind) => {
    expect(errorKindForStatus(status)).toBe(kind);
  });
});

describe("mapApiError", () => {
  it("401 membersihkan sesi dan tidak retryable", () => {
    const e = mapApiError(401);
    expect(e.kind).toBe("unauthorized");
    expect(e.clearSession).toBe(true);
    expect(e.retryable).toBe(false);
  });

  it("403 → akses terbatas, tanpa clearSession", () => {
    const e = mapApiError(403);
    expect(e.kind).toBe("forbidden");
    expect(e.title).toMatch(/Akses terbatas/i);
    expect(e.clearSession).toBe(false);
  });

  it("404 → data tidak ditemukan (ErrorState)", () => {
    expect(mapApiError(404).kind).toBe("not-found");
  });

  it("422/409 tidak retryable (dipetakan ke form/modal)", () => {
    expect(mapApiError(422).retryable).toBe(false);
    expect(mapApiError(409).retryable).toBe(false);
    expect(mapApiError(409).kind).toBe("conflict");
  });

  it("500/503 → server tidak tersedia dan boleh retry", () => {
    const server = mapApiError(500);
    const unavailable = mapApiError(503);
    expect(server.retryable).toBe(true);
    expect(unavailable.retryable).toBe(true);
    expect(unavailable.kind).toBe("unavailable");
    expect(unavailable.message).toMatch(/tidak dapat melayani|beberapa saat/i);
  });

  it("429 → rate limit dan boleh retry", () => {
    const e = mapApiError(429);
    expect(e.kind).toBe("rate-limit");
    expect(e.retryable).toBe(true);
  });

  it("network error (status 0) → pesan koneksi yang dapat di-retry", () => {
    const e = mapApiError(0);
    expect(e.kind).toBe("offline");
    expect(e.retryable).toBe(true);
    expect(e.message).toMatch(/koneksi/i);
  });

  it("memakai pesan backend bila ada (validasi informatif)", () => {
    expect(mapApiError(422, "NIK sudah terdaftar").message).toBe("NIK sudah terdaftar");
  });

  it("pesan backend kosong/spasi → pesan netral (tidak kosong)", () => {
    expect(mapApiError(409, "   ").message.length).toBeGreaterThan(0);
    expect(mapApiError(409, null).message).toBe(mapApiError(409).message);
  });

  it("configError menang atas pesan lain dan tidak retryable (gap F1-C)", () => {
    const e = mapApiError(0, undefined, { configError: "NEXT_PUBLIC_API_URL kosong" });
    expect(e.kind).toBe("config");
    expect(e.message).toBe("NEXT_PUBLIC_API_URL kosong");
    expect(e.retryable).toBe(false);
  });

  it("tidak pernah membocorkan stack trace pada pesan default", () => {
    for (const status of [0, 400, 401, 403, 404, 409, 422, 429, 500, 503, 599]) {
      const message = mapApiError(status).message;
      expect(message).not.toMatch(/\bat\s+\w+\.\w+|stack trace|node_modules|TypeError:|ReferenceError:/);
    }
  });
});

describe("safeErrorMessage", () => {
  it("memetakan ApiError-like tanpa membocorkan detail", () => {
    const message = safeErrorMessage({ status: 503, message: "" });
    expect(message).toMatch(/tidak dapat melayani|beberapa saat/i);
  });

  it("menerima Error biasa", () => {
    expect(safeErrorMessage(new Error("Cakupan organisasi tidak ditemukan"))).toBe(
      "Cakupan organisasi tidak ditemukan"
    );
  });

  it("objek tak dikenal → pesan netral", () => {
    expect(safeErrorMessage({})).toBe(mapApiError(-1).message);
  });
});
