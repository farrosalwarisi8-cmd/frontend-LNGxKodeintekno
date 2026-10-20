/**
 * A3 — View model siklus MCU untuk layar review Dokter OH.
 *
 * dibangun dari data `GET /mcu/cycles` (API backend). Tidak ada perhitungan
 * klinis di berkas ini: nilai, status, dan tanggal ditampilkan apa adanya.
 */
import {
  readSuggestedFtw,
  type FtwCategory,
} from "@/features/oh-review/ftw";
import {
  hasWorsening,
  hasWorseningMarker,
  toCalculationRows,
  type CalculationRow,
} from "@/features/oh-review/calculation-display";
import type { BackendMcuCycle } from "@/lib/services/mcu.service";

/** Satu pembatasan kerja pada satu siklus MCU. */
export interface ReviewRestriction {
  id: string;
  description: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  status: string | null;
  supervisor: string | null;
  controls: string | null;
}

/** Ringkasan siklus MCU untuk antrean & detail review. */
export interface ReviewCycle {
  id: string;
  /** Nama worker (identitas minimum yang tampil di layar review). */
  patientName: string;
  medicalRecordNo: string;
  employeeNo: string;
  siteName: string;
  /** Nama perusahaan tidak tersedia pada kontrak siklus MCU. */
  companyName: string | null;
  mcuType: string;
  mcuTypeLabel: string;
  examinationDate: string;
  validFrom: string | null;
  validUntil: string | null;
  cycleStatus: string | null;
  /** Status FTW mentah dari API (null bila belum ada keputusan). */
  ftwStatus: string | null;
  ftwDecisionAt: string | null;
  ftwDecidedBy: string | null;
  ftwSummary: string | null;
  hasDecision: boolean;
  /** Saran FTW dari sistem (hanya bila API mengirimkannya). */
  suggestedFtw: FtwCategory | null;
  restrictions: ReviewRestriction[];
  /** Baris nilai hasil perhitungan server. */
  calculations: CalculationRow[];
  /** API mengirim penanda perburukan? */
  worseningAvailable: boolean;
  /** Ada baris yang ditandai perburukan? */
  worsening: boolean;
  /** Nomor MCU ringkas yang dipakai backend saat merender dokumen. */
  mcuNumber: string;
}

const MCU_TYPE_LABELS: Record<string, string> = {
  PRE_EMPLOYMENT: "Pre-Employment",
  ANNUAL_PERIODIC: "Annual Periodic",
  SPECIAL_HAZARD: "Special Hazard",
  OFFSHORE_CLEARANCE: "Offshore Clearance",
  POST_ILLNESS: "Post Illness",
};

const CLOSED_RESTRICTION_STATUSES = new Set(["CLOSED", "RESOLVED", "LIFTED", "ENDED"]);

function sliceDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

/** Apakah pembatasan sudah ditutup? (status dari API) */
export function isClosedRestriction(status: string | null | undefined): boolean {
  if (!status) return false;
  return CLOSED_RESTRICTION_STATUSES.has(status.trim().toUpperCase());
}

/** Bangun view model satu siklus MCU dari respons API. */
export function toReviewCycle(cycle: BackendMcuCycle): ReviewCycle {
  const patient = cycle.patient;
  const employee = patient?.employee;
  const assessment = cycle.ftw_assessment;
  const calculations = toCalculationRows(cycle.calculations);

  const restrictions: ReviewRestriction[] = (assessment?.restrictions ?? [])
    .filter((restriction) => Boolean(restriction?.id))
    .map((restriction) => ({
      id: restriction.id,
      description: restriction.description?.trim() || "Restriksi kerja (tanpa deskripsi dari API)",
      effectiveDate: sliceDate(restriction.effective_date),
      reviewDate: sliceDate(restriction.review_date),
      status: restriction.status ?? null,
      supervisor: restriction.supervisor ?? null,
      controls: restriction.controls ?? null,
    }));

  return {
    id: cycle.id,
    patientName:
      employee?.full_name?.trim() || patient?.full_name?.trim() || "Nama tidak tersedia dari API",
    medicalRecordNo: patient?.medical_record_no?.trim() ?? "",
    employeeNo: employee?.employee_no?.trim() ?? "",
    siteName: employee?.site?.name?.trim() ?? "",
    companyName: null,
    mcuType: cycle.mcu_type,
    mcuTypeLabel: MCU_TYPE_LABELS[cycle.mcu_type] ?? cycle.mcu_type,
    examinationDate: sliceDate(cycle.examination_date) ?? "",
    validFrom: sliceDate(cycle.valid_from),
    validUntil: sliceDate(cycle.valid_until ?? assessment?.valid_until),
    cycleStatus: cycle.status ?? null,
    ftwStatus: assessment?.ftw_status ?? null,
    ftwDecisionAt: sliceDate(assessment?.assessed_at),
    ftwDecidedBy: assessment?.assessed_by ?? null,
    ftwSummary: assessment?.summary ?? null,
    hasDecision: Boolean(assessment?.ftw_status),
    suggestedFtw: readSuggestedFtw(cycle as unknown),
    restrictions,
    calculations,
    worseningAvailable: hasWorseningMarker(calculations),
    worsening: hasWorsening(calculations),
    mcuNumber: `MCU-${cycle.id.slice(0, 8).toUpperCase()}`,
  };
}

/** Bangun view model dari seluruh respons API. */
export function toReviewCycles(cycles: BackendMcuCycle[] | null | undefined): ReviewCycle[] {
  return (cycles ?? []).map(toReviewCycle);
}

/** Restriksi aktif (belum ditutup) pada satu siklus. */
export function activeRestrictions(cycle: ReviewCycle): ReviewRestriction[] {
  return cycle.restrictions.filter((restriction) => !isClosedRestriction(restriction.status));
}

/** Riwayat restriksi (sudah ditutup) pada satu siklus. */
export function closedRestrictions(cycle: ReviewCycle): ReviewRestriction[] {
  return cycle.restrictions.filter((restriction) => isClosedRestriction(restriction.status));
}
