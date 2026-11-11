/**
 * A3 — Aturan hasil screening & confirmation test D&A.
 *
 * Frontend TIDAK menentukan apa yang dianggap positif. Semua penentuan
 * "perlu confirmation test" berasal dari data/flag API:
 *  - status tes `CONFIRMATION_PENDING`, atau
 *  - `screening_result` bernilai `NON_NEGATIVE` (kosakata API).
 */
import type { BackendDaResult, BackendDaTest } from "@/lib/services/da.service";

/** Status tes D&A dari API. */
export const DA_TEST_STATUSES = [
  "REGISTERED",
  "SAMPLE_COLLECTED",
  "CONFIRMATION_PENDING",
  "FINALIZED",
  "CANCELLED",
] as const;

/** Hasil screening dari API (NEGATIVE / NON_NEGATIVE). */
export const SCREENING_RESULTS = ["NEGATIVE", "NON_NEGATIVE"] as const;

/**
 * Apakah hasil screening memerlukan confirmation test?
 *
 * Berdasarkan data API, bukan ambang frontend.
 */
export function requiresConfirmationTest(test: BackendDaTest | null | undefined): boolean {
  if (!test) return false;
  if ((test.status ?? "").trim().toUpperCase() === "CONFIRMATION_PENDING") return true;
  const screening = test.results?.[0]?.screening_result;
  if (typeof screening === "string" && screening.trim().toUpperCase() === "NON_NEGATIVE") {
    return true;
  }
  return false;
}

/** Label hasil screening (apa adanya dari API). */
export function screeningResultLabel(value: string | null | undefined): string {
  if (!value) return "Belum ada hasil screening";
  return value;
}

/** Label hasil konfirmasi (apa adanya dari API). */
export function confirmationResultLabel(result: BackendDaResult | null | undefined): string {
  if (!result) return "Belum ada hasil konfirmasi";
  if (!result.confirmation_result) return "Belum ada hasil konfirmasi";
  return result.confirmation_result;
}

/** Apakah hasil konfirmasi sudah tercatat? */
export function hasConfirmationResult(result: BackendDaResult | null | undefined): boolean {
  return Boolean(result?.confirmation_result);
}

/** Apakah hasil sudah dikonfirmasi (flag `confirmed` dari API)? */
export function isConfirmed(result: BackendDaResult | null | undefined): boolean {
  return result?.confirmed === true;
}
