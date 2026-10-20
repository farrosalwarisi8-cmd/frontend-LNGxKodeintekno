/**
 * A3 — Pemetaan nilai hasil perhitungan yang dikembalikan server.
 *
 * Sumber data: field `calculations` pada `GET /mcu/cycles` (siklus MCU).
 *
 * ATURAN MUTLAK (A3):
 *  - Frontend TIDAK menghitung BMI, klasifikasi tekanan darah, audiometri,
 *    spirometri, skor CV, maupun perbandingan dengan tahun lalu. Semua angka
 *    yang tampil di layar ini adalah nilai apa adanya dari API.
 *  - Tidak ada ambang, rumus, atau tabel referensi klinis di berkas ini.
 *    Yang ada HANYA: (1) pemetaan nama field API -> label tampilan, dan
 *    (2) pembacaan penanda perburukan yang diambil dari flag boolean eksplisit
 *    yang dikirim server.
 *  - Key yang tidak dikenal ditampilkan apa adanya (nama field mentah
 *    dib-humanize) — maknanya TIDAK ditebak.
 *  - Boolean selain penanda perburukan tidak ditampilkan sebagai baris nilai
 *    supaya tidak salah dibaca sebagai penilaian klinis oleh frontend.
 */

/** Baris nilai siap tampil. */
export interface CalculationRow {
  /** Key API asal (untuk penelusuran & kunci React). */
  key: string;
  /** Label tampilan. */
  label: string;
  /** Nilai apa adanya dari API (already stringified, tanpa pembulatan). */
  value: string;
  /** Satuan dari API, atau `null` bila API tidak mengirimnya. */
  unit: string | null;
  /**
   * Penanda perburukan dari API:
   *  - `true`  : server menandai perburukan,
   *  - `false` : server menandai tidak ada perburukan,
   *  - `null`  : API tidak mengirim flag perburukan untuk nilai ini.
   */
  worsening: boolean | null;
}

/** Label known-metric API -> label tampilan. */
const METRIC_LABELS: Record<string, string> = {
  bmi: "BMI (Indeks Massa Tubuh)",
  body_mass_index: "BMI (Indeks Massa Tubuh)",
  height_cm: "Tinggi badan",
  weight_kg: "Berat badan",
  systolic_bp: "Tekanan darah sistolik",
  diastolic_bp: "Tekanan darah diastolik",
  blood_pressure: "Tekanan darah",
  bp: "Tekanan darah",
  jnc: "Klasifikasi tekanan darah",
  jnc8: "Klasifikasi tekanan darah",
  jnc_classification: "Klasifikasi tekanan darah",
  bp_classification: "Klasifikasi tekanan darah",
  heart_rate: "Denyut jantung",
  pulse: "Denyut jantung",
  audiometry: "Audiometri",
  audio: "Audiometri",
  hearing: "Pendengaran",
  audio_sts: "Skor STS audiometri",
  spirometry: "Spirometri",
  fev1: "Spirometri (FEV1)",
  fvc: "Spirometri (FVC)",
  cv_score: "Skor kardiovaskular",
  cardiovascular_score: "Skor kardiovaskular",
  cardiovascular_risk: "Skor kardiovaskular",
  ascvd: "Skor kardiovaskular (ASCVD)",
};

/** Key yang membawa penanda perburukan (hanya yang eksplisit dari server). */
const WORSENING_FLAG_KEYS = [
  "worsening",
  "is_worsening",
  "worsened",
  "deteriorated",
  "is_deteriorated",
  "worse_than_previous",
  "worse_than_last_year",
  "regressed",
  "is_regression",
] as const;

/** Key yang biasanya memuat nama metrik pada satu entri perhitungan. */
const NAME_KEYS = [
  "name",
  "metric",
  "label",
  "parameter",
  "parameter_name",
  "title",
  "key",
  "code",
  "rule",
  "rule_code",
] as const;

/** Key yang biasanya memuat nilai utama pada satu entri perhitungan. */
const VALUE_KEYS = ["value", "result", "val", "score", "measurement"] as const;

/** Key yang biasanya memuat satuan. */
const UNIT_KEYS = ["unit", "units", "unit_symbol", "satuan"] as const;

/** Key metadata/parametrik yang tidak ditampilkan sebagai nilai. */
const SKIP_KEYS = new Set<string>([
  "id",
  "uuid",
  "created_at",
  "updated_at",
  "createdat",
  "updatedat",
  "status",
  "source",
  "version",
  "threshold",
  "min",
  "max",
  "min_value",
  "max_value",
  "reference_range",
  "reference",
  "parameters",
  "notes",
  "note",
  "description",
  "interpretation",
  "recommendation",
  "category",
  "severity",
  "abnormal_flag",
  "flag",
  "is_abnormal",
  ...WORSENING_FLAG_KEYS,
]);

const MAX_ROWS = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

/** Ubah `audio_sts_left` menjadi `Audio Sts Left` (tanpa menafsirkan isi). */
export function humanizeFieldKey(key: string): string {
  const cleaned = key.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return key;
  return cleaned
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Label friendly untuk key API; key tak dikenal tetap ditampilkan apa adanya. */
export function metricLabel(key: string): string {
  const normalized = key.trim().toLowerCase();
  return METRIC_LABELS[normalized] ?? humanizeFieldKey(key);
}

function firstString(
  record: Record<string, unknown>,
  keys: readonly string[]
): { key: string; value: string } | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return { key, value: value.trim() };
  }
  return null;
}

function firstScalar(
  record: Record<string, unknown>,
  keys: readonly string[]
): { key: string; value: string | number } | null {
  for (const key of keys) {
    const value = record[key];
    if (isScalar(value)) return { key, value };
  }
  return null;
}

/** Baca penanda perburukan dari satu entri (hanya flag boolean eksplisit). */
export function readWorseningFlag(record: Record<string, unknown>): boolean | null {
  let result: boolean | null = null;
  for (const key of WORSENING_FLAG_KEYS) {
    const value = record[key];
    if (typeof value !== "boolean") continue;
    if (value === true) return true;
    result = false;
  }
  return result;
}

/**
 * Ubah `calculations[]` dari API menjadi baris tampilan.
 *
 * Tidak ada perhitungan, pembulatan, atau ambang di sini — nilai ditampilkan
 * apa adanya seperti dikirim server.
 */
export function toCalculationRows(calculations: unknown): CalculationRow[] {
  if (!Array.isArray(calculations)) return [];
  const rows: CalculationRow[] = [];

  for (const entry of calculations) {
    if (rows.length >= MAX_ROWS) break;
    if (!isRecord(entry)) continue;

    const worsening = readWorseningFlag(entry);
    const unitEntry = firstString(entry, UNIT_KEYS);
    const unit = unitEntry ? unitEntry.value : null;

    // Bentuk 1: entri punya satu nilai utama (value/result/score/...).
    const mainValue = firstScalar(entry, VALUE_KEYS);
    const nameEntry = firstString(entry, NAME_KEYS);
    if (mainValue && nameEntry) {
      rows.push({
        key: `${nameEntry.key}:${mainValue.key}`,
        label: metricLabel(nameEntry.value),
        value: String(mainValue.value),
        unit,
        worsening,
      });
      continue;
    }

    // Bentuk 2: entri berisi beberapa field skalar (mis. sistolik + diastolik).
    for (const [key, value] of Object.entries(entry)) {
      if (rows.length >= MAX_ROWS) break;
      if (SKIP_KEYS.has(key.toLowerCase())) continue;
      if (!isScalar(value)) continue;
      rows.push({
        key,
        label: metricLabel(key),
        value: String(value),
        unit,
        worsening,
      });
    }
  }

  return rows;
}

/** Apakah ada penanda perburukan di antara baris perhitungan? */
export function hasWorseningMarker(rows: CalculationRow[]): boolean {
  return rows.some((row) => row.worsening !== null);
}

/** Apakah ada baris yang ditandai perburukan? */
export function hasWorsening(rows: CalculationRow[]): boolean {
  return rows.some((row) => row.worsening === true);
}
