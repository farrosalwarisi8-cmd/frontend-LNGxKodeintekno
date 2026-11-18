/** Pesan aman bersama untuk UI TTE (tidak memuat detail internal/secret). */
import { mapTteError } from "@/features/tte/error-mapping";

export const TTE_MESSAGES = {
  requestSubmitted: "Permintaan tanda tangan terkirim. Status akan diperbarui otomatis.",
  retrySubmitted: "Request baru diterbitkan untuk dokumen yang sama.",
  selectDocument: "Pilih dokumen terlebih dahulu.",
  noDocument: "Dokumen tidak tersedia.",
} as const;

/** Format error menjadi pesan netral yang aman ditampilkan. */
export function formatErrorMessage(error: unknown): string {
  return mapTteError(error).message;
}
