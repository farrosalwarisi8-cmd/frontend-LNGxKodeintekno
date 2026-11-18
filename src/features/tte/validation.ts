/**
 * Validasi UX (bukan pengganti validasi server).
 *
 * Backend tetap satu-satunya otoritas: ukuran 15 MB, header PDF, content type,
 * dan enum signature type diverifikasi ulang di server. Di sini hanya untuk
 * mencegah request yang jelas-jelas salah dan memberi pesan lebih awal.
 */

export const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Enum RequestSignatureDto.signatureType dari OpenAPI backend. */
export const BACKEND_SIGNATURE_TYPES = ["INTERNAL_PIN", "CERTIFIED_PSRE"] as const;
export type BackendSignatureType = (typeof BACKEND_SIGNATURE_TYPES)[number];

export const SIGNATURE_TYPE_LABEL: Record<BackendSignatureType, string> = {
  INTERNAL_PIN: "PIN Internal",
  CERTIFIED_PSRE: "PSrE Tersertifikasi",
};

export function isBackendSignatureType(value: unknown): value is BackendSignatureType {
  return typeof value === "string" && (BACKEND_SIGNATURE_TYPES as readonly string[]).includes(value);
}

export interface PdfCandidate {
  name?: string;
  type?: string;
  size?: number;
}

export type PdfValidationReason = "missing" | "not-pdf" | "too-large" | "invalid-size";

export interface PdfValidationResult {
  ok: boolean;
  reason?: PdfValidationReason;
  message?: string;
}

/**
 * Cek UX untuk berkas PDF. Tidak membaca isi berkas — hanya nama, MIME, dan
 * ukuran bila tersedia di browser.
 */
export function validatePdfCandidate(file: PdfCandidate | null | undefined): PdfValidationResult {
  if (!file) return { ok: false, reason: "missing", message: "Pilih berkas PDF terlebih dahulu." };

  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const mime = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isPdf =
    mime === "application/pdf" ||
    mime === "application/x-pdf" ||
    (!mime && name.endsWith(".pdf"));
  if (!isPdf) {
    return { ok: false, reason: "not-pdf", message: "Berkas harus berformat PDF." };
  }

  if (typeof file.size === "number") {
    if (!Number.isFinite(file.size) || file.size < 0) {
      return { ok: false, reason: "invalid-size", message: "Ukuran berkas tidak dapat dibaca." };
    }
    if (file.size > MAX_PDF_BYTES) {
      return {
        ok: false,
        reason: "too-large",
        message: "PDF melebihi batas 15 MB. Kecilkan berkas lalu coba lagi.",
      };
    }
  }

  return { ok: true };
}

/** True bila ukuran (bila diketahui browser) masih di bawah batas 15 MB. */
export function isWithinPdfSizeLimit(size: number | null | undefined): boolean {
  if (size == null) return true;
  return Number.isFinite(size) && size >= 0 && size <= MAX_PDF_BYTES;
}
