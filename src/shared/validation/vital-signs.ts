/**
 * Validasi rentang tanda-tanda vital (TTV) — frontend only.
 *
 * Tujuan: perawat/admin klinik langsung tahu saat nilai yang diketik berada di
 * luar rentang yang masuk akal, sebelum data dikirim ke backend. Ini murni
 * lapisan UX: backend tetap sumber kebenaran (tidak ada aturan klinis baru yang
 * dibuat di sini).
 *
 * Dua jenis batas dibedakan sengaja:
 *  - `hardMin`/`hardMax` → kemungkinan besar salah ketik (mis. sistolik 900).
 *    Form TIDAK boleh lanjut (`critical`).
 *  - `warnBelow`/`warnAbove` → nilai masih mungkin benar tetapi perlu perhatian
 *    (mis. demam 38,5 °C). Hanya peringatan, tidak memblokir (`warning`).
 */

export type VitalField =
  | "systolicBp"
  | "diastolicBp"
  | "pulse"
  | "temperature"
  | "respiratoryRate"
  | "spo2"
  | "weightKg"
  | "heightCm";

export interface VitalSpec {
  label: string;
  unit: string;
  /** Batas fisiologis: di luar rentang ini dianggap salah input. */
  hardMin: number;
  hardMax: number;
  /** Ambang klinis (opsional) — memicu peringatan, bukan blokir. */
  warnBelow?: number;
  warnAbove?: number;
  /** Teks bantuan yang ditampilkan di bawah input. */
  hint: string;
  inputStep?: string;
}

export const VITAL_SPECS: Record<VitalField, VitalSpec> = {
  systolicBp: {
    label: "Tekanan darah sistolik",
    unit: "mmHg",
    hardMin: 40,
    hardMax: 300,
    warnBelow: 90,
    warnAbove: 160,
    hint: "Rentang lazim 90–160 mmHg",
  },
  diastolicBp: {
    label: "Tekanan darah diastolik",
    unit: "mmHg",
    hardMin: 20,
    hardMax: 200,
    warnBelow: 60,
    warnAbove: 100,
    hint: "Rentang lazim 60–100 mmHg",
  },
  pulse: {
    label: "Nadi",
    unit: "x/menit",
    hardMin: 20,
    hardMax: 250,
    warnBelow: 50,
    warnAbove: 120,
    hint: "Rentang lazim 50–120 x/menit",
  },
  temperature: {
    label: "Suhu",
    unit: "°C",
    hardMin: 30,
    hardMax: 45,
    warnBelow: 36,
    warnAbove: 37.5,
    hint: "Rentang lazim 36–37,5 °C",
    inputStep: "0.1",
  },
  respiratoryRate: {
    label: "Laju napas",
    unit: "x/menit",
    hardMin: 4,
    hardMax: 80,
    warnBelow: 12,
    warnAbove: 24,
    hint: "Rentang lazim 12–24 x/menit",
  },
  spo2: {
    label: "SpO₂",
    unit: "%",
    hardMin: 50,
    hardMax: 100,
    warnBelow: 94,
    hint: "Normal ≥ 94%",
  },
  weightKg: {
    label: "Berat badan",
    unit: "kg",
    hardMin: 2,
    hardMax: 400,
    hint: "2–400 kg",
    inputStep: "0.1",
  },
  heightCm: {
    label: "Tinggi badan",
    unit: "cm",
    hardMin: 30,
    hardMax: 250,
    hint: "30–250 cm",
  },
};

export type VitalSeverity = "ok" | "warning" | "critical";

export interface VitalAssessment {
  field: VitalField;
  /** `null` bila kosong atau bukan angka. */
  value: number | null;
  severity: VitalSeverity;
  empty: boolean;
  message?: string;
}

function isBlank(raw: string | number | null | undefined): boolean {
  return raw === null || raw === undefined || String(raw).trim() === "";
}

/** Validasi satu field TTV. Field kosong → `empty: true`, tanpa pesan. */
export function validateVital(
  field: VitalField,
  raw: string | number | null | undefined
): VitalAssessment {
  const spec = VITAL_SPECS[field];
  if (isBlank(raw)) {
    return { field, value: null, severity: "ok", empty: true };
  }

  // Terima koma sebagai pemisah desimal (kebiasaan input Indonesia).
  const parsed = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return {
      field,
      value: null,
      severity: "critical",
      empty: false,
      message: `${spec.label} harus berupa angka.`,
    };
  }

  if (parsed < spec.hardMin || parsed > spec.hardMax) {
    return {
      field,
      value: parsed,
      severity: "critical",
      empty: false,
      message: `${spec.label} ${parsed} ${spec.unit} di luar rentang wajar (${spec.hardMin}–${spec.hardMax} ${spec.unit}). Periksa kembali.`,
    };
  }

  const belowWarn = spec.warnBelow !== undefined && parsed < spec.warnBelow;
  const aboveWarn = spec.warnAbove !== undefined && parsed > spec.warnAbove;
  if (belowWarn || aboveWarn) {
    return {
      field,
      value: parsed,
      severity: "warning",
      empty: false,
      message: `${spec.label} ${parsed} ${spec.unit} — ${spec.hint}.`,
    };
  }

  return { field, value: parsed, severity: "ok", empty: false };
}

export interface VitalsSummary {
  byField: Partial<Record<VitalField, VitalAssessment>>;
  /** Tingkat terburuk dari seluruh field. */
  severity: VitalSeverity;
  messages: string[];
  /** `false` bila ada field `critical` (termasuk field wajib yang kosong). */
  canProceed: boolean;
}

/**
 * Nilai sekumpulan TTV sekaligus.
 *
 * @param values  peta field → nilai mentah dari form
 * @param required field yang wajib diisi; kosong dianggap `critical` supaya
 *                 tombol lanjut/submit tidak bisa dilewati.
 */
export function assessVitals(
  values: Partial<Record<VitalField, string | number | null>>,
  required: readonly VitalField[] = []
): VitalsSummary {
  const byField: Partial<Record<VitalField, VitalAssessment>> = {};
  const messages: string[] = [];
  let worst: VitalSeverity = "ok";

  for (const field of Object.keys(VITAL_SPECS) as VitalField[]) {
    if (!(field in values)) continue;
    const result = validateVital(field, values[field]);
    byField[field] = result;

    if (result.empty && required.includes(field)) {
      byField[field] = {
        ...result,
        severity: "critical",
        message: `${VITAL_SPECS[field].label} wajib diisi.`,
      };
    }
  }

  for (const field of required) {
    if (!(field in values)) continue;
    const result = byField[field];
    if (!result) continue;
    if (result.severity === "critical") worst = "critical";
    else if (result.severity === "warning" && worst === "ok") worst = "warning";
    if (result.message) messages.push(result.message);
  }

  return { byField, severity: worst, messages, canProceed: worst !== "critical" };
}

/** Pesan error untuk komponen `Input` (hanya `critical` yang memblokir). */
export function vitalFieldError(assessment: VitalAssessment | undefined): string | undefined {
  if (!assessment || assessment.severity !== "critical") return undefined;
  return assessment.message;
}

/** Ringkasan singkat untuk badge peringatan (mis. "2 nilai perlu perhatian"). */
export function vitalWarningCount(summary: VitalsSummary): number {
  return Object.values(summary.byField).filter((a) => a?.severity === "warning").length;
}
