/**
 * A3 — Pemetaan status dokumen (resume MCU & sertifikat) dari API.
 *
 * Sumber data: `GET /documents` (field `status`, `signature_reqs[]`).
 * Dokumen resmi baru sah setelah ditandatangani pada tahap TTE (A4) — A3
 * hanya menampilkan status dan pratinjau.
 *
 * Tidak ada logika penandatanganan di berkas ini.
 */

export type DocumentStatusTone = "default" | "success" | "warning" | "danger" | "info";

export interface DocumentStatusInfo {
  /** Label status yang tampil ke pengguna. */
  label: string;
  /** Varian tone untuk badge (bukan warna hardcode di komponen lain). */
  tone: DocumentStatusTone;
  /** Apakah dokumen sudah sah (ditandatangani)? */
  signed: boolean;
}

const SIGNED_SIGNATURE_STATUSES = new Set(["SIGNED", "COMPLETED", "VERIFIED"]);

/**
 * Status dokumen dari backend:
 *  - DRAFT  → "Draft"
 *  - FINAL/LOCKED + tanda tangan selesai → sudah sah
 *  - FINAL/LOCKED tanpa tanda tangan selesai → "Siap, menunggu tanda tangan"
 *  - AMENDED → sudah ada addendum (koreksi)
 *  - VOID    → dicabut
 */
export function documentStatusInfo(
  status: string | null | undefined,
  signatureStatuses: readonly string[] = []
): DocumentStatusInfo {
  const normalized = (status ?? "").trim().toUpperCase();
  const signatures = signatureStatuses.map((s) => s.trim().toUpperCase());
  const allSigned =
    signatures.length > 0 && signatures.every((s) => SIGNED_SIGNATURE_STATUSES.has(s));

  switch (normalized) {
    case "DRAFT":
      return { label: "Draft", tone: "default", signed: false };
    case "FINAL":
    case "LOCKED":
      if (allSigned) {
        return { label: "Bertanda tangan (dokumen sah)", tone: "success", signed: true };
      }
      return { label: "Siap, menunggu tanda tangan", tone: "warning", signed: false };
    case "AMENDED":
      return { label: "Telah direvisi (addendum)", tone: "info", signed: true };
    case "VOID":
      return { label: "Dicabut", tone: "danger", signed: false };
    default:
      return {
        label: "Status dokumen belum tersedia dari API",
        tone: "default",
        signed: false,
      };
  }
}

/** Status signature request pada satu dokumen. */
export function signatureStatusInfo(
  status: string | null | undefined
): { label: string; tone: DocumentStatusTone } {
  const normalized = (status ?? "").trim().toUpperCase();
  switch (normalized) {
    case "SIGNED":
    case "COMPLETED":
    case "VERIFIED":
      return { label: "Sudah ditandatangani", tone: "success" };
    case "PENDING":
    case "PROCESSING":
      return { label: "Menunggu tanda tangan", tone: "warning" };
    case "FAILED":
      return { label: "Gagal ditandatangani", tone: "danger" };
    case "EXPIRED":
      return { label: "Kedaluwarsa", tone: "danger" };
    default:
      return { label: "Status tanda tangan tidak tersedia", tone: "default" };
  }
}
