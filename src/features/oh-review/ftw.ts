/**
 * A3 — Kategori FTW & aturan deviasi dari saran sistem.
 *
 * ATURAN MUTLAK (A3):
 *  - Frontend TIDAK menentukan kategori FTW. Kategori hanya dipilih Dokter OH.
 *  - "Saran sistem" HANYA ditampilkan bila API mengirimkannya (backend belum
 *    menyediakan field saran FTW — lihat BLOCKER BACKEND di laporan A3).
 *  - Alasan deviasi WAJIB diisi bila pilihan dokter berbeda dari saran sistem.
 *    Bila API tidak mengirim saran, aturan ini tidak aktif dan alasannya
 *    dicatat sebagai opsional (dengan keterangan jujur di UI).
 */

export type FtwCategory =
  | "FIT"
  | "FIT_WITH_RESTRICTION"
  | "TEMPORARILY_UNFIT"
  | "UNFIT";

export interface FtwCategoryOption {
  value: FtwCategory;
  label: string;
  /** Penjelasan singkat kategori (bukan ambang/rumus klinis). */
  description: string;
}

/** Empat kategori FTW sesuai proposal (urutan tetap). */
export const FTW_CATEGORIES: readonly FtwCategoryOption[] = [
  {
    value: "FIT",
    label: "Fit",
    description: "Pekerja laik bekerja tanpa pembatasan.",
  },
  {
    value: "FIT_WITH_RESTRICTION",
    label: "Fit with Restriction",
    description: "Pekerja laik bekerja dengan pembatasan kerja yang berlaku.",
  },
  {
    value: "TEMPORARILY_UNFIT",
    label: "Temporarily Unfit",
    description: "Pekerja belum dapat bekerja untuk sementara.",
  },
  {
    value: "UNFIT",
    label: "Unfit",
    description: "Pekerja tidak laik bekerja.",
  },
];

/** Label FTW dari nilai API (apa adanya, tanpa menafsirkan). */
export function ftwLabel(status: string | null | undefined): string {
  if (!status) return "Belum ada keputusan";
  const known = FTW_CATEGORIES.find((option) => option.value === status);
  if (known) return known.label;
  return status;
}

/** Apakah nilai string merupakan salah satu kategori FTW yang dikenal? */
export function isFtwCategory(value: unknown): value is FtwCategory {
  return FTW_CATEGORIES.some((option) => option.value === value);
}

/**
 * Baca saran FTW dari data API.
 *
 * Backend belum menyediakan field saran FTW pada `GET /mcu/cycles`; fungsi ini
 * hanya membayar field yang benar-benar dikirim server (bila someday ada),
 * tanpa menebak nilainya dari data lain.
 */
export function readSuggestedFtw(source: unknown): FtwCategory | null {
  if (typeof source !== "object" || source === null) return null;
  const record = source as Record<string, unknown>;
  const candidates = [
    "suggested_ftw_status",
    "suggestedFtwStatus",
    "ftw_suggestion",
    "ftwSuggestion",
    "system_suggestion",
    "systemSuggestion",
    "recommended_ftw_status",
  ];
  for (const key of candidates) {
    const value = record[key];
    if (isFtwCategory(value)) return value;
  }
  return null;
}

/**
 * Apakah alasan deviasi wajib diisi?
 *
 * Wajib HANYA bila ada saran sistem dari API dan pilihan dokter berbeda
 * dari saran tersebut.
 */
export function requiresDeviationReason(
  suggested: FtwCategory | null,
  chosen: FtwCategory | null
): boolean {
  if (!suggested || !chosen) return false;
  return suggested !== chosen;
}

/** Pesan yang ditampilkan di bawah field alasan. */
export function deviationReasonHint(
  suggested: FtwCategory | null,
  chosen: FtwCategory | null
): string {
  if (!suggested) {
    return (
      "Saran sistem tidak tersedia dari API, jadi alasan deviasi tidak diwajibkan. " +
      "Alasan tetap disarankan untuk penelusuran."
    );
  }
  if (!chosen) {
    return `Saran sistem: ${ftwLabel(suggested)}. Alasan deviasi wajib diisi bila pilihan berbeda.`;
  }
  if (requiresDeviationReason(suggested, chosen)) {
    return (
      `Pilihan Anda (${ftwLabel(chosen)}) berbeda dari saran sistem (${ftwLabel(suggested)}). ` +
      "Alasan deviasi wajib diisi."
    );
  }
  return `Pilihan Anda sama dengan saran sistem (${ftwLabel(suggested)}).`;
}

/** Validasi form penetapan FTW. */
export interface FtwFormValidation {
  valid: boolean;
  errors: string[];
}

export function validateFtwForm(input: {
  chosen: FtwCategory | null;
  suggested: FtwCategory | null;
  reason: string;
  restrictionDescription?: string;
  restrictionReviewDate?: string;
}): FtwFormValidation {
  const errors: string[] = [];
  if (!input.chosen) errors.push("Pilih kategori FTW terlebih dahulu.");
  if (requiresDeviationReason(input.suggested, input.chosen) && !input.reason.trim()) {
    errors.push("Alasan deviasi dari saran sistem wajib diisi.");
  }
  if (input.chosen === "FIT_WITH_RESTRICTION") {
    if (!input.restrictionDescription?.trim()) {
      errors.push("Deskripsi pembatasan wajib diisi untuk Fit with Restriction.");
    }
    if (!input.restrictionReviewDate?.trim()) {
      errors.push("Tanggal review pembatasan wajib diisi untuk Fit with Restriction.");
    }
  }
  return { valid: errors.length === 0, errors };
}
