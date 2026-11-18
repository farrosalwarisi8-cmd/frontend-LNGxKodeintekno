import { describe, expect, it } from "vitest";
import {
  KNOWN_SIGNATURE_STATUSES,
  UNKNOWN_STATUS_MESSAGE,
  hasActiveSignatureStatus,
  isKnownSignatureStatus,
  mapSignatureStatus,
} from "@/features/tte/signature-status";
import { mapTteError, tteErrorKindForStatus } from "@/features/tte/error-mapping";
import { decidePolling, pollDelayForAttempt, POLL_BASE_MS, POLL_MAX_MS } from "@/features/tte/polling";
import {
  BACKEND_SIGNATURE_TYPES,
  MAX_PDF_BYTES,
  isBackendSignatureType,
  isWithinPdfSizeLimit,
  validatePdfCandidate,
} from "@/features/tte/validation";
import {
  UnsafeDocumentUrlError,
  assertSafeDocumentUrl,
  safeDownloadFilename,
  validatePdfPayload,
} from "@/features/tte/download";
import { classifyVerifyResult, decodeVerifyToken, maskVerifyToken } from "@/features/tte/verify-state";

const API = "https://api.example.com/api/v1";

describe("TTE — status mapping", () => {
  it("mengenali seluruh status yang ada pada kontrak backend", () => {
    expect([...KNOWN_SIGNATURE_STATUSES]).toEqual([
      "PENDING",
      "PROCESSING",
      "SIGNED",
      "FAILED",
      "EXPIRED",
      "CANCELLED",
    ]);
    for (const status of KNOWN_SIGNATURE_STATUSES) {
      expect(isKnownSignatureStatus(status)).toBe(true);
      expect(isKnownSignatureStatus(status.toLowerCase())).toBe(true);
    }
  });

  it("hanya PENDING/PROCESSING yang aktif dan boleh dipoll", () => {
    expect(mapSignatureStatus("PENDING").isActive).toBe(true);
    expect(mapSignatureStatus("PROCESSING").isActive).toBe(true);
    expect(hasActiveSignatureStatus(["SIGNED", "PROCESSING"])).toBe(true);
    expect(hasActiveSignatureStatus(["SIGNED", "FAILED", "EXPIRED", "CANCELLED"])).toBe(false);
  });

  it("download hanya muncul untuk SIGNED", () => {
    expect(mapSignatureStatus("SIGNED").canDownload).toBe(true);
    for (const s of ["PENDING", "PROCESSING", "FAILED", "EXPIRED", "CANCELLED"]) {
      expect(mapSignatureStatus(s).canDownload).toBe(false);
    }
  });

  it("retry hanya FAILED/EXPIRED — CANCELLED tidak dianggap SIGNED", () => {
    expect(mapSignatureStatus("FAILED").canRetry).toBe(true);
    expect(mapSignatureStatus("EXPIRED").canRetry).toBe(true);
    expect(mapSignatureStatus("CANCELLED").canRetry).toBe(false);
    expect(mapSignatureStatus("CANCELLED").isSigned).toBe(false);
  });

  it("status tidak dikenal jatuh ke fallback aman, bukan SIGNED", () => {
    for (const raw of ["SIGNED_BY_MOCK", "PROVIDER_OK", "", null, undefined]) {
      const view = mapSignatureStatus(raw);
      expect(view.known).toBe(false);
      expect(view.label).toBe(UNKNOWN_STATUS_MESSAGE);
      expect(view.isSigned).toBe(false);
      expect(view.canDownload).toBe(false);
      expect(view.canRetry).toBe(false);
      expect(view.isActive).toBe(false);
    }
  });
});

describe("TTE — error mapping", () => {
  const cases: Array<[number, string]> = [
    [400, "payload"],
    [401, "session"],
    [403, "permission"],
    [404, "not-found"],
    [409, "conflict"],
    [413, "pdf-too-large"],
    [415, "not-pdf"],
    [422, "invalid-document"],
    [429, "rate-limit"],
    [502, "provider-unavailable"],
    [504, "provider-timeout"],
    [500, "backend"],
    [0, "offline"],
  ];
  it.each(cases)("status %i → %s", (status, kind) => {
    expect(tteErrorKindForStatus(status)).toBe(kind);
    expect(mapTteError({ status, message: "x" }).kind).toBe(kind);
  });

  it("5xx lain masuk kategori backend/network", () => {
    expect(tteErrorKindForStatus(503)).toBe("backend");
    expect(tteErrorKindForStatus(599)).toBe("backend");
  });

  it("403 ditandai accessDenied", () => {
    expect(mapTteError({ status: 403 }).accessDenied).toBe(true);
    expect(mapTteError({ status: 409 }).accessDenied).toBe(false);
  });

  it("pesan backend TIDAK diteruskan (hindari kebocoran secret/internal)", () => {
    const secret = "PSP_API_KEY=rahasia callback=https://internal/cb";
    const mapped = mapTteError({ status: 502, message: secret });
    expect(mapped.message).not.toContain(secret);
    expect(mapped.message).not.toMatch(/PSP_|callback|internal/i);
  });

  it("URL unduhan tidak aman memakai pesan khusus, bukan pesan offline umum", () => {
    const mapped = mapTteError(new UnsafeDocumentUrlError());
    expect(mapped.kind).toBe("unsafe-link");
    expect(mapped.message).toMatch(/tidak aman/i);
    expect(mapped.retryable).toBe(false);
  });

  it("pesan konfigurasi frontend boleh diteruskan", () => {
    const cfg = "Konfigurasi tidak valid: NEXT_PUBLIC_API_URL belum diisi";
    expect(mapTteError({ status: 0, message: cfg }).kind).toBe("config");
    expect(mapTteError({ status: 0, message: cfg }).message).toContain("NEXT_PUBLIC_API_URL");
  });
});

describe("TTE — polling", () => {
  it("hanya poll saat ada status aktif dan environment mendukung", () => {
    expect(decidePolling({ statuses: ["PENDING"], enabled: true, online: true, hidden: false })).toBe("poll");
    expect(decidePolling({ statuses: ["PROCESSING"], enabled: true, online: true, hidden: false })).toBe("poll");
    expect(decidePolling({ statuses: ["SIGNED"], enabled: true, online: true, hidden: false })).toBe("idle");
    expect(decidePolling({ statuses: ["FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"], enabled: true, online: true, hidden: false })).toBe("idle");
  });

  it("berhenti saat tab hidden, offline, atau auto-refresh dimatikan", () => {
    const base = { statuses: ["PENDING"], enabled: true, online: true, hidden: false };
    expect(decidePolling({ ...base, hidden: true })).toBe("idle");
    expect(decidePolling({ ...base, online: false })).toBe("idle");
    expect(decidePolling({ ...base, enabled: false })).toBe("idle");
  });

  it("backoff naik sampai batas maksimal", () => {
    expect(pollDelayForAttempt(0)).toBe(POLL_BASE_MS);
    expect(pollDelayForAttempt(1)).toBe(POLL_BASE_MS * 2);
    expect(pollDelayForAttempt(2)).toBe(POLL_BASE_MS * 4);
    expect(pollDelayForAttempt(3)).toBe(POLL_MAX_MS);
    expect(pollDelayForAttempt(99)).toBe(POLL_MAX_MS);
  });
});

describe("TTE — validasi UX", () => {
  it("hanya enum backend yang diterima", () => {
    expect([...BACKEND_SIGNATURE_TYPES]).toEqual(["INTERNAL_PIN", "CERTIFIED_PSRE"]);
    expect(isBackendSignatureType("CERTIFIED_PSRE")).toBe(true);
    expect(isBackendSignatureType("INTERNAL_PIN")).toBe(true);
    expect(isBackendSignatureType("DIGITAL")).toBe(false);
    expect(isBackendSignatureType("signed_by_mock")).toBe(false);
  });

  it("batas 15 MB dan tipe PDF divalidasi di client sebagai UX", () => {
    expect(MAX_PDF_BYTES).toBe(15 * 1024 * 1024);
    expect(validatePdfCandidate({ name: "a.pdf", type: "application/pdf", size: MAX_PDF_BYTES }).ok).toBe(true);
    expect(validatePdfCandidate({ name: "a.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }).reason).toBe("too-large");
    expect(validatePdfCandidate({ name: "a.docx", type: "application/msword", size: 10 }).reason).toBe("not-pdf");
    expect(validatePdfCandidate(null).reason).toBe("missing");
    expect(isWithinPdfSizeLimit(MAX_PDF_BYTES)).toBe(true);
    expect(isWithinPdfSizeLimit(undefined)).toBe(true);
    expect(isWithinPdfSizeLimit(MAX_PDF_BYTES + 1)).toBe(false);
  });
});

describe("TTE — unduhan aman", () => {
  it("menerima URL https dari backend", () => {
    expect(assertSafeDocumentUrl("https://storage.example.com/file.pdf?sig=abc", API)).toContain("https://storage.example.com/file.pdf");
  });

  it("menolak skema berbahaya, credential, dan http non-local", () => {
    for (const bad of ["javascript:alert(1)", "data:application/pdf;base64,AAA", "https://user:pass@host/file.pdf", "http://storage.example.com/file.pdf", "", 123, null]) {
      expect(() => assertSafeDocumentUrl(bad, API)).toThrow(UnsafeDocumentUrlError);
    }
  });

  it("menerima http pada localhost untuk development", () => {
    expect(assertSafeDocumentUrl("http://localhost:9000/file.pdf", "http://localhost:3000/api/v1")).toContain("http://localhost:9000/file.pdf");
  });

  it("validasi payload PDF: content type, header, ukuran", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    expect(validatePdfPayload({ contentType: "application/pdf", bytes: pdf }).ok).toBe(true);
    expect(validatePdfPayload({ contentType: "text/html", bytes: pdf }).reason).toBe("content-type");
    expect(validatePdfPayload({ contentType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) }).reason).toBe("header");
    expect(validatePdfPayload({ contentType: "application/pdf", bytes: new Uint8Array(0) }).reason).toBe("empty");
    expect(validatePdfPayload({ contentType: "application/pdf", bytes: pdf, contentLength: MAX_PDF_BYTES + 1 }).reason).toBe("too-large");
  });

  it("nama berkas aman tanpa token/query", () => {
    const name = safeDownloadFilename("Sertifikat FTW?token=rahasia&x=1", "doc-123");
    expect(name).toMatch(/^sertifikat-ftw-token-rahasia-x-1-doc-123\.pdf$/);
    expect(name).not.toContain("?");
    expect(name).not.toContain("=");
  });
});

describe("TTE — verifikasi publik", () => {
  it("membedakan valid, belum signed, invalid, expired, revoked", () => {
    expect(classifyVerifyResult({ isValid: true, status: "VERIFIED" }).state).toBe("valid");
    expect(classifyVerifyResult({ isValid: false, status: "NOT_SIGNED" }).state).toBe("found-unsigned");
    expect(classifyVerifyResult({ isValid: false, status: "INVALID" }).state).toBe("invalid");
    expect(classifyVerifyResult({ isValid: false, status: "EXPIRED" }).state).toBe("expired");
    expect(classifyVerifyResult({ isValid: false, status: "REVOKED" }).state).toBe("revoked");
    expect(classifyVerifyResult({ isValid: false, status: "INVALID_OR_EXPIRED" }).state).toBe("expired-or-invalid");
  });

  it("tidak pernah menampilkan dokumen sebagai valid hanya karena flag isValid", () => {
    expect(classifyVerifyResult({ isValid: true, status: "NOT_SIGNED" }).showAsValid).toBe(false);
    expect(classifyVerifyResult({ isValid: true, status: "UNKNOWN_FUTURE_STATUS" }).showAsValid).toBe(false);
    expect(classifyVerifyResult({ isValid: false, status: "VERIFIED" }).showAsValid).toBe(false);
  });

  it("state backend error / token kosong", () => {
    expect(classifyVerifyResult(null, { hasToken: true, hasError: true }).state).toBe("backend-error");
    expect(classifyVerifyResult(null, { hasToken: false }).state).toBe("empty");
  });

  it("decode token aman terhadap URI malformed", () => {
    expect(decodeVerifyToken("abc%20def")).toBe("abc def");
    expect(decodeVerifyToken("%E0%A4%A")).toBe("");
    expect(maskVerifyToken("abcdefghijk")).toBe("abcdefgh…");
  });
});
