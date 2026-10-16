import type {
  ClinicVisit,
  Employee,
  HealthCertificate,
  MCU,
  Medicine,
  StockBatch,
  WorkHealthStatus,
} from "../../../lib/types";
import type { DashboardTileKey } from "./role-tasks";
import { MCU_DUE_SOON_DAYS, isDueSoon, isPast } from "../../shared/utils/due-soon";

// Satu definisi "jatuh tempo" dipakai bersama halaman /health-status.
export { MCU_DUE_SOON_DAYS, isDueSoon, isPast };

/**
 * Perhitungan angka dashboard per peran — dipisah dari komponen supaya bisa
 * diuji tanpa React dan tanpa backend (semua input di-inject).
 *
 * Semua angka berasal dari data yang benar-benar tersinkron dari backend
 * (`lib/remote-sync.ts`). Tidak ada angka karangan: bila data belum ada,
 * nilainya 0 atau "—" (bukan angka contoh).
 */

export interface DashboardMetricsInput {
  employees: Employee[];
  mcus: MCU[];
  visits: ClinicVisit[];
  certificates: HealthCertificate[];
  workHealthStatus: WorkHealthStatus[];
  medicines: Medicine[];
  stockBatches: StockBatch[];
  /** Tanggal acuan ISO (yyyy-mm-dd) — di-inject agar hasilnya deterministik. */
  today: string;
  /** Employee milik akun yang login (kartu "saya" untuk peran pekerja). */
  currentEmployeeId?: string | null;
  dueSoonDays?: number;
}

export type DashboardTileValue = number | string;

function countQueueWaiting(visits: ClinicVisit[]): number {
  return visits.filter((v) => v.status === "In Queue" || v.status === "Registered").length;
}

export function computeDashboardMetrics(
  input: DashboardMetricsInput
): Record<DashboardTileKey, DashboardTileValue> {
  const {
    employees,
    mcus,
    visits,
    certificates,
    workHealthStatus,
    medicines,
    stockBatches,
    today,
    currentEmployeeId,
    dueSoonDays = MCU_DUE_SOON_DAYS,
  } = input;

  const pendingMcu = mcus.filter(
    (m) => m.status === "Submitted" || m.status === "Resubmitted"
  ).length;

  // Jatuh tempo = masa berlaku FTW/MCU habis dalam `dueSoonDays` hari
  // (termasuk yang sudah lewat — itu justru paling mendesak).
  const mcuDueSoon = workHealthStatus.filter((w) =>
    isDueSoon(w.validUntil, today, dueSoonDays)
  ).length;

  const myStatus = currentEmployeeId
    ? workHealthStatus.find((w) => w.employeeId === currentEmployeeId)
    : undefined;

  const lowStock = stockBatches.filter((b) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    return med ? b.quantity < med.minStock : false;
  }).length;

  return {
    employees: employees.length,
    pendingMcu,
    mcuDueSoon,
    visitsToday: visits.filter((v) => v.date === today).length,
    queueWaiting: countQueueWaiting(visits),
    validCerts: certificates.filter((c) => c.status === "valid").length,
    fitToWork: workHealthStatus.filter((w) => w.status === "Fit to Work").length,
    fitWithRestriction: workHealthStatus.filter((w) => w.status === "Fit with Restriction").length,
    restricted: workHealthStatus.filter((w) => Boolean(w.restriction)).length,
    lowStock,
    // Angka resep menunggu datang dari backend (isi lewat `mergePendingPrescriptions`).
    pendingPrescriptions: 0,
    myFitStatus: myStatus ? myStatus.status : "—",
    myNextMcu: myStatus?.validUntil ? myStatus.validUntil.slice(0, 10) : "—",
  };
}

/** Sisipkan jumlah resep menunggu yang diambil langsung dari backend. */
export function mergePendingPrescriptions(
  metrics: Record<DashboardTileKey, DashboardTileValue>,
  count: number | null
): Record<DashboardTileKey, DashboardTileValue> {
  return { ...metrics, pendingPrescriptions: count ?? "—" };
}

export interface TileMeta {
  label: string;
  /** Nama ikon lucide (dipetakan di komponen dashboard). */
  icon: string;
  tone: "primary" | "success" | "warning" | "danger" | "info" | "purple";
  /** Tautan "lihat detail" — opsional. */
  href?: string;
}

export const TILE_META: Record<DashboardTileKey, TileMeta> = {
  employees: { label: "Total pekerja", icon: "users", tone: "primary", href: "/employees" },
  pendingMcu: { label: "MCU menunggu dokter", icon: "clock", tone: "warning", href: "/mcu/review" },
  mcuDueSoon: {
    label: `MCU jatuh tempo ≤ ${MCU_DUE_SOON_DAYS} hari`,
    icon: "calendar-check",
    tone: "danger",
    href: "/health-status?filter=due-soon",
  },
  visitsToday: { label: "Kunjungan hari ini", icon: "clipboard-list", tone: "purple", href: "/visits" },
  queueWaiting: { label: "Antrean menunggu", icon: "list-ordered", tone: "info", href: "/visits/queue" },
  validCerts: { label: "Sertifikat valid", icon: "badge-check", tone: "success", href: "/certificates" },
  fitToWork: { label: "Fit to Work", icon: "heart-pulse", tone: "success", href: "/health-status" },
  fitWithRestriction: {
    label: "Fit with Restriction",
    icon: "heart-pulse",
    tone: "warning",
    href: "/health-status?filter=restriction",
  },
  restricted: {
    label: "Memiliki restriction",
    icon: "alert-triangle",
    tone: "danger",
    href: "/health-status?filter=restriction",
  },
  lowStock: { label: "Stok rendah", icon: "alert-triangle", tone: "danger", href: "/medicine" },
  pendingPrescriptions: {
    label: "Resep menunggu dispensing",
    icon: "pill",
    tone: "info",
    href: "/medicine/dispense",
  },
  myFitStatus: { label: "Status FTW saya", icon: "heart-pulse", tone: "success", href: "/my/mcu" },
  myNextMcu: { label: "Berlaku sampai", icon: "calendar-check", tone: "info", href: "/my/mcu" },
};

export interface DashboardTile extends TileMeta {
  key: DashboardTileKey;
  value: DashboardTileValue;
}

/** Susun kartu angka sesuai urutan yang diminta profil peran. */
export function buildTiles(
  keys: readonly DashboardTileKey[],
  metrics: Record<DashboardTileKey, DashboardTileValue>
): DashboardTile[] {
  return keys.map((key) => ({ key, value: metrics[key] ?? 0, ...TILE_META[key] }));
}

/** Bagian dari `visits` yang masih berjalan (untuk daftar "kunjungan terbaru"). */
export function openVisits(visits: ClinicVisit[]): ClinicVisit[] {
  return visits.filter((v) => v.status !== "Completed" && v.status !== "Referred");
}
