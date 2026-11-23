import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  formatDocumentSize,
  validateDocumentFile,
} from "../document-upload";

describe("validateDocumentFile()", () => {
  it("menerima PDF, JPG, dan PNG di bawah 5 MB", () => {
    expect(validateDocumentFile({ name: "ktp.pdf", size: 1024, type: "application/pdf" })).toEqual({
      ok: true,
    });
    expect(validateDocumentFile({ name: "foto.JPG", size: 2048, type: "image/jpeg" })).toEqual({
      ok: true,
    });
    expect(validateDocumentFile({ name: "hasil.png", size: 2048, type: "image/png" })).toEqual({
      ok: true,
    });
  });

  it("menerima berkas tanpa MIME bila ekstensinya didukung (kamera/HP)", () => {
    expect(validateDocumentFile({ name: "scan.pdf", size: 1024, type: "" })).toEqual({ ok: true });
  });

  it("menolak berkas lebih dari 5 MB dengan pesan spesifik", () => {
    const result = validateDocumentFile({
      name: "besar.pdf",
      size: MAX_DOCUMENT_BYTES + 1,
      type: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("melebihi batas 5 MB");
      expect(result.message).toContain("besar.pdf");
    }
  });

  it("menolak tipe yang tidak didukung dengan pesan spesifik", () => {
    const result = validateDocumentFile({ name: "dokumen.docx", size: 1024, type: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("tidak didukung");
      expect(result.message).toContain("PDF, JPG, atau PNG");
    }
  });

  it("menolak berkas kosong", () => {
    const result = validateDocumentFile({ name: "kosong.pdf", size: 0, type: "application/pdf" });
    expect(result.ok).toBe(false);
  });
});

describe("formatDocumentSize()", () => {
  it("menampilkan satuan yang terbaca", () => {
    expect(formatDocumentSize(512)).toBe("512 B");
    expect(formatDocumentSize(2048)).toBe("2.0 KB");
    expect(formatDocumentSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
