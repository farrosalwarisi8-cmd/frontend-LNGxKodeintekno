import { describe, expect, it } from "vitest";
import {
  documentStatusInfo,
  signatureStatusInfo,
} from "@/features/oh-review/document-status";
import { buildResumeModel, toDocumentMeta } from "@/features/certificates/resume-model";
import { toReviewCycle } from "@/features/oh-review/review-cycle";

/**
 * A3 — Pemetaan status dokumen & versi resume.
 *
 * Dokumen sah hanya setelah TTE (A4); A3 hanya menampilkan status.
 */

describe("A3 — status dokumen", () => {
  it("DRAFT berlabel Draft", () => {
    const info = documentStatusInfo("DRAFT");
    expect(info.label).toBe("Draft");
    expect(info.signed).toBe(false);
  });

  it("FINAL tanpa tanda tangan berlabel 'Siap, menunggu tanda tangan'", () => {
    const info = documentStatusInfo("FINAL");
    expect(info.label).toBe("Siap, menunggu tanda tangan");
    expect(info.signed).toBe(false);
  });

  it("LOCKED dengan signature selesai berstatus bertanda tangan", () => {
    const info = documentStatusInfo("LOCKED", ["SIGNED"]);
    expect(info.signed).toBe(true);
    expect(info.label).toContain("Bertanda tangan");
  });

  it("signature yang belum selesai tetap 'Siap, menunggu tanda tangan'", () => {
    const info = documentStatusInfo("FINAL", ["PENDING"]);
    expect(info.label).toBe("Siap, menunggu tanda tangan");
    expect(info.signed).toBe(false);
  });

  it("AMENDED berlabel revisi addendum, VOID berlabel dicabut", () => {
    expect(documentStatusInfo("AMENDED").label).toContain("addendum");
    expect(documentStatusInfo("VOID").label).toBe("Dicabut");
  });

  it("status yang tidak dikenal tidak ditebak", () => {
    const info = documentStatusInfo("STATUS_MISTERIUS");
    expect(info.label).toBe("Status dokumen belum tersedia dari API");
    expect(info.signed).toBe(false);
  });

  it("status tanda tangan dipetakan satu per satu", () => {
    expect(signatureStatusInfo("SIGNED").tone).toBe("success");
    expect(signatureStatusInfo("PENDING").tone).toBe("warning");
    expect(signatureStatusInfo("FAILED").tone).toBe("danger");
    expect(signatureStatusInfo(null).label).toContain("tidak tersedia");
  });
});

describe("A3 — metadata dokumen dari API", () => {
  it("mengambil versi & hash dari API", () => {
    const meta = toDocumentMeta({
      id: "doc-1",
      status: "DRAFT",
      updated_at: "2026-10-01T08:00:00.000Z",
      sha256_hash: "abcdef1234567890",
    });
    expect(meta.version).toBe("2026-10-01T08:00:00.000Z");
    expect(meta.hash).toBe("abcdef123456…");
    expect(meta.documentId).toBe("doc-1");
  });

  it("tanpa dokumen tetap jujur (tidak mengarang versi)", () => {
    const meta = toDocumentMeta(null);
    expect(meta.version).toBeNull();
    expect(meta.hash).toBeNull();
    expect(meta.statusLabel).toBe("Status dokumen belum tersedia dari API");
  });
});

describe("A3 — resume disusun dari data API", () => {
  const cycle = toReviewCycle({
    id: "cycle-abcdef123456",
    patient_id: "patient-1",
    mcu_type: "ANNUAL_PERIODIC",
    examination_date: "2026-10-01",
    patient: {
      medical_record_no: "MRN-0001",
      full_name: "Budi Santoso",
      employee: { employee_no: "EMP-001", full_name: "Budi Santoso", site: { name: "Site A" } },
    },
    ftw_assessment: {
      id: "assessment-1",
      ftw_status: "FIT_WITH_RESTRICTION",
      summary: "Laik dengan pembatasan",
      assessed_at: "2026-10-02T09:00:00.000Z",
      restrictions: [
        {
          id: "restriction-1",
          description: "Dilarang bekerja di ketinggian > 2 meter",
          effective_date: "2026-10-02",
          review_date: "2027-01-04",
          status: "ACTIVE",
        },
      ],
    },
    calculations: [
      { name: "bmi", value: 24.5, unit: "kg/m2" },
      { name: "systolic_bp", value: 128, unit: "mmHg" },
    ],
  });

  it("memuat identitas minimum, ringkasan hasil, keputusan, dan restriksi", () => {
    const model = buildResumeModel(cycle, null);
    expect(model.identity.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Nama pekerja", "MRN", "Nomor pekerja", "Site", "Jenis MCU"])
    );
    expect(model.results).toHaveLength(2);
    expect(model.decision.ftwLabel).toBe("Fit with Restriction");
    expect(model.restrictions).toHaveLength(1);
    expect(model.mcuNumber).toBe("MCU-CYCLE-AB");
  });

  it("memakai status dokumen dari API", () => {
    const model = buildResumeModel(cycle, {
      id: "doc-1",
      status: "FINAL",
      title: "Sertifikat Kelaikan Kerja MCU-CYCLE-AB",
    });
    expect(model.document.statusLabel).toBe("Siap, menunggu tanda tangan");
  });
});
