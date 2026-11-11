/**
 * A3 — View model resume MCU & sertifikat FTW (pratinjau).
 *
 * Resume disusun dari data API yang tersedia (siklus MCU + dokumen resmi).
 * Tidak ada data yang dikarang: field yang tidak ada dari API ditampilkan
 * sebagai "—"/"tidak tersedia", bukan diisi tebakan.
 */
import type { CalculationRow } from "@/features/oh-review/calculation-display";
import { ftwLabel } from "@/features/oh-review/ftw";
import type { ReviewCycle, ReviewRestriction } from "@/features/oh-review/review-cycle";
import {
  documentStatusInfo,
  type DocumentStatusTone,
} from "@/features/oh-review/document-status";
import type { BackendDocument } from "@/lib/services/document.service";

export interface DocumentMeta {
  /** Status dokumen sesuai API. */
  statusLabel: string;
  statusTone: DocumentStatusTone;
  /** Sudah sah (ditandatangani) atau belum. */
  signed: boolean;
  /** Versi dokumen (terakhir diperbarui) dari API. */
  version: string | null;
  /** Hash dokumen dari API (potongan pendek untuk verifikasi). */
  hash: string | null;
  /** Nomor dokumen bila ada. */
  documentId: string | null;
}

export interface ResumeModel {
  mcuNumber: string;
  identity: Array<{ label: string; value: string }>;
  results: CalculationRow[];
  decision: {
    ftwStatus: string | null;
    ftwLabel: string;
    decidedAt: string | null;
    decidedBy: string | null;
    summary: string | null;
  };
  restrictions: ReviewRestriction[];
  document: DocumentMeta;
}

/** Bangun metadata dokumen dari respons API `GET /documents`. */
export function toDocumentMeta(document: BackendDocument | null): DocumentMeta {
  if (!document) {
    return {
      statusLabel: "Status dokumen belum tersedia dari API",
      statusTone: "default",
      signed: false,
      version: null,
      hash: null,
      documentId: null,
    };
  }
  const signatureStatuses = (document.signature_reqs ?? [])
    .map((signature) => signature?.status ?? "")
    .filter(Boolean);
  const info = documentStatusInfo(document.status, signatureStatuses);
  return {
    statusLabel: info.label,
    statusTone: info.tone,
    signed: info.signed,
    version: document.updated_at ?? document.created_at ?? null,
    hash: document.sha256_hash ? `${document.sha256_hash.slice(0, 12)}…` : null,
    documentId: document.id ?? null,
  };
}

/** Susun resume MCU dari siklus + dokumen. */
export function buildResumeModel(
  cycle: ReviewCycle,
  document: BackendDocument | null
): ResumeModel {
  const identity: Array<{ label: string; value: string }> = [
    { label: "Nama pekerja", value: cycle.patientName },
    { label: "MRN", value: cycle.medicalRecordNo || "—" },
    { label: "Nomor pekerja", value: cycle.employeeNo || "—" },
    { label: "Site", value: cycle.siteName || "—" },
    { label: "Jenis MCU", value: cycle.mcuTypeLabel },
    { label: "Tanggal pemeriksaan", value: cycle.examinationDate || "—" },
    { label: "Masa berlaku", value: cycle.validUntil ? `s.d. ${cycle.validUntil}` : "—" },
  ];

  return {
    mcuNumber: cycle.mcuNumber,
    identity,
    results: cycle.calculations,
    decision: {
      ftwStatus: cycle.ftwStatus,
      ftwLabel: ftwLabel(cycle.ftwStatus),
      decidedAt: cycle.ftwDecisionAt,
      decidedBy: cycle.ftwDecidedBy,
      summary: cycle.ftwSummary,
    },
    restrictions: cycle.restrictions,
    document: toDocumentMeta(document),
  };
}
