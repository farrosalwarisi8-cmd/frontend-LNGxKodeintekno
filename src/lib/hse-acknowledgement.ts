/**
 * Modul murni (tanpa React) untuk UI Acknowledgement Restriksi Kerja oleh HSE.
 *
 * Gap F2-A: `mcuService.acknowledgeRestriction()` sudah ada sejak awal tetapi
 * tidak pernah dipanggil halaman mana pun. Modul ini memisahkan *logika status*
 * dari komponen supaya bisa diuji unit tanpa DOM, dan supaya aturan
 * "jangan pernah menampilkan acknowledged sebelum response API sukses" serta
 * "jangan pernah mengarang persistence" dapat diverifikasi otomatis.
 */

export type AcknowledgementType = "HR" | "HSE" | "LINE_MANAGER";

export const ACKNOWLEDGEMENT_TYPE_OPTIONS: ReadonlyArray<{
  value: AcknowledgementType;
  label: string;
}> = [
  { value: "HSE", label: "HSE (K3)" },
  { value: "HR", label: "HR / PIC" },
  { value: "LINE_MANAGER", label: "Line Manager" },
];

/** Status UI acknowledgement untuk satu restriksi. */
export type AckState =
  | "not-acknowledged"
  | "submitting"
  | "acknowledged"
  | "failed"
  | "not-available";

export interface AckSessionState {
  state: AckState;
  /** Timestamp dari response backend (`acknowledged_at`), bukan waktu lokal. */
  acknowledgedAt: string | null;
  /** Id record acknowledgement dari response backend. */
  acknowledgementId: string | null;
  error: string | null;
}

export const INITIAL_ACK_SESSION: AckSessionState = {
  state: "not-acknowledged",
  acknowledgedAt: null,
  acknowledgementId: null,
  error: null,
};

export type AckAction =
  | { type: "submit" }
  | { type: "success"; acknowledgementId?: string | null; acknowledgedAt?: string | null }
  | { type: "failure"; message: string }
  | { type: "reset" };

/**
 * Reducer status acknowledgement.
 *
 * Aturan penting:
 *  - `submit` saat sudah `submitting` tidak menghasilkan perubahan (anti
 *    double-submit pada level state).
 *  - `acknowledged` HANYA dapat dicapai lewat action `success` (yaitu setelah
 *    response API sukses) — tidak ada jalur lain.
 */
export function acknowledgeReducer(state: AckSessionState, action: AckAction): AckSessionState {
  switch (action.type) {
    case "submit":
      if (state.state === "submitting" || state.state === "acknowledged") return state;
      return { state: "submitting", acknowledgedAt: null, acknowledgementId: null, error: null };
    case "success":
      return {
        state: "acknowledged",
        acknowledgedAt: action.acknowledgedAt ?? null,
        acknowledgementId: action.acknowledgementId ?? null,
        error: null,
      };
    case "failure":
      return {
        state: "failed",
        acknowledgedAt: null,
        acknowledgementId: null,
        error: action.message || "Acknowledgement gagal dikirim.",
      };
    case "reset":
      return INITIAL_ACK_SESSION;
    default:
      return state;
  }
}

/** Tombol Acknowledge boleh diklik? */
export function canSubmitAck(state: AckState): boolean {
  return state === "not-acknowledged" || state === "failed";
}

/** Label tombol sesuai status. */
export function ackButtonLabel(state: AckState): string {
  switch (state) {
    case "submitting":
      return "Mengirim...";
    case "acknowledged":
      return "Terkonfirmasi";
    case "failed":
      return "Coba kirim ulang";
    case "not-available":
      return "Tidak tersedia";
    default:
      return "Acknowledge restriction";
  }
}

export const ACK_PERSISTENCE_NOTE =
  "Acknowledgement berhasil dikirim ke server. Backend belum menyediakan endpoint baca " +
  "status acknowledgement, sehingga status setelah refresh belum dapat diverifikasi oleh API — " +
  "status ini hanya berlaku untuk sesi ini.";

/**
 * Keterbatasan persistence yang harus ditampilkan setelah sukses.
 * Tidak pernah menyembunyikan fakta bahwa status tidak bisa dibaca ulang.
 */
export function ackPersistenceNote(persistedStateReadable: boolean): string | null {
  return persistedStateReadable ? null : ACK_PERSISTENCE_NOTE;
}

// ---------------------------------------------------------------------------
// Ekstraksi restriksi dari respons `GET /mcu/cycles`
// ---------------------------------------------------------------------------

export interface RestrictionSource {
  id?: string | null;
  description?: string | null;
  effective_date?: string | null;
  review_date?: string | null;
  status?: string | null;
  supervisor?: string | null;
  controls?: string | null;
}

export interface CycleWithRestrictions {
  id?: string;
  patient?: {
    full_name?: string | null;
    medical_record_no?: string | null;
    employee?: { employee_no?: string | null; full_name?: string | null } | null;
  } | null;
  ftw_assessment?: {
    ftw_status?: string | null;
    restrictions?: RestrictionSource[] | null;
  } | null;
}

export interface RestrictionItem {
  id: string;
  description: string;
  effectiveDate: string | null;
  reviewDate: string | null;
  status: string | null;
  supervisor: string | null;
  controls: string | null;
  ftwStatus: string | null;
  patientName: string | null;
  employeeNo: string | null;
  mcuCycleId: string | null;
}

const CLOSED_STATUSES = new Set(["CLOSED", "RESOLVED", "LIFTED"]);

export function isClosedRestriction(status?: string | null): boolean {
  return status ? CLOSED_STATUSES.has(status.toUpperCase()) : false;
}

/**
 * Mengambil restriksi kerja aktif dari daftar MCU cycle.
 * Restriksi yang sudah ditutup tidak perlu di-acknowledge lagi.
 */
export function extractRestrictions(cycles: CycleWithRestrictions[]): RestrictionItem[] {
  const items: RestrictionItem[] = [];
  for (const cycle of cycles ?? []) {
    const restrictions = cycle?.ftw_assessment?.restrictions ?? [];
    for (const r of restrictions) {
      if (!r?.id) continue;
      if (isClosedRestriction(r.status)) continue;
      items.push({
        id: r.id,
        description: r.description?.trim() || "Restriksi kerja (tanpa deskripsi dari API)",
        effectiveDate: (r.effective_date ?? "").slice(0, 10) || null,
        reviewDate: (r.review_date ?? "").slice(0, 10) || null,
        status: r.status ?? null,
        supervisor: r.supervisor ?? null,
        controls: r.controls ?? null,
        ftwStatus: cycle?.ftw_assessment?.ftw_status ?? null,
        patientName:
          cycle?.patient?.employee?.full_name ?? cycle?.patient?.full_name ?? null,
        employeeNo:
          cycle?.patient?.employee?.employee_no ?? cycle?.patient?.medical_record_no ?? null,
        mcuCycleId: cycle?.id ?? null,
      });
    }
  }
  return items.sort((a, b) => (a.reviewDate ?? "9999").localeCompare(b.reviewDate ?? "9999"));
}

/** Format timestamp dari backend untuk ditampilkan (aman bila kosong). */
export function formatAckTimestamp(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
