/**
 * PETA STATUS KLINIS — satu berkas untuk seluruh status yang tampil di UI.
 *
 * Aturan warna (identitas logo LNG):
 *   hijau  = selesai / Fit / berhasil
 *   merah  = bahaya / Unfit / gagal
 *   amber  = perlu perhatian (revisi, pembatasan, menunggu)
 *   biru   = informasi / proses berjalan
 *   netral = belum ada makna klinis (draft, terkunci, nonaktif)
 *
 * Setiap entri WAJIB punya `label` DAN `icon`: status tidak pernah ditandai
 * dengan warna saja (aksesibilitas & cetak hitam-putih).
 *
 * `lib/constants.ts` tetap mengekspor MCU_STATUS, HEALTH_STATUS, dst. dari
 * berkas ini agar seluruh konsumen yang sudah ada tidak perlu diubah impornya.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  CalendarX,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock3,
  Eye,
  FileText,
  Hourglass,
  Lock,
  Pill,
  RefreshCw,
  Send,
  ShieldAlert,
  Stethoscope,
  Undo2,
  UserCheck,
  UserX,
} from "lucide-react";
import type { HealthStatus, MCUStatus, VisitStatus, EmployeeStatus } from "@/lib/types";

export interface StatusMeta {
  /** Label teks — selalu ditampilkan, bukan warna saja. */
  label: string;
  /** Kelas token semantik (latar lembut + teks bermakna). */
  color: string;
  /** Ikon pendamping yang mengikuti warna teks (currentColor). */
  icon: LucideIcon;
}

const NEUTRAL = "bg-muted text-text-secondary";
const INFO = "bg-info-100 text-info-600";
const WARNING = "bg-warning-100 text-warning-600";
const SUCCESS = "bg-success-100 text-success-600";
const DANGER = "bg-danger-100 text-danger-600";

export const MCU_STATUS: Record<MCUStatus, StatusMeta> = {
  Draft: { label: "Draft", color: NEUTRAL, icon: FileText },
  Submitted: { label: "Submitted", color: INFO, icon: Send },
  "Under Review": { label: "Under Review", color: WARNING, icon: Eye },
  "Revision Required": { label: "Revision Required", color: WARNING, icon: Undo2 },
  Resubmitted: { label: "Resubmitted", color: INFO, icon: RefreshCw },
  Approved: { label: "Approved", color: SUCCESS, icon: CircleCheck },
  Rejected: { label: "Rejected", color: DANGER, icon: CircleX },
  Closed: { label: "Closed", color: NEUTRAL, icon: Lock },
};

export const HEALTH_STATUS: Record<HealthStatus, StatusMeta> = {
  "Fit to Work": { label: "Fit to Work", color: SUCCESS, icon: CircleCheck },
  "Fit with Restriction": { label: "Fit with Restriction", color: WARNING, icon: ShieldAlert },
  "Temporarily Unfit": { label: "Temporarily Unfit", color: WARNING, icon: AlertTriangle },
  "Pending Further Evaluation": {
    label: "Pending Further Evaluation",
    color: INFO,
    icon: Hourglass,
  },
  Unfit: { label: "Unfit", color: DANGER, icon: CircleX },
};

export const VISIT_STATUS: Record<VisitStatus, StatusMeta> = {
  Registered: { label: "Registered", color: NEUTRAL, icon: ClipboardList },
  "In Queue": { label: "In Queue", color: INFO, icon: Clock3 },
  "In Consultation": { label: "In Consultation", color: WARNING, icon: Stethoscope },
  "Awaiting Pharmacy": { label: "Awaiting Pharmacy", color: INFO, icon: Pill },
  Completed: { label: "Completed", color: SUCCESS, icon: CircleCheck },
  Referred: { label: "Referred", color: WARNING, icon: ArrowRight },
  Locked: { label: "Locked", color: NEUTRAL, icon: Lock },
};

export const EMPLOYEE_STATUS: Record<EmployeeStatus, StatusMeta> = {
  Active: { label: "Active", color: SUCCESS, icon: UserCheck },
  Inactive: { label: "Inactive", color: NEUTRAL, icon: UserX },
  Mutated: { label: "Mutated", color: INFO, icon: ArrowRightLeft },
  "Contract Ended": { label: "Contract Ended", color: DANGER, icon: CalendarX },
};

export const CERT_STATUS: Record<string, StatusMeta> = {
  valid: { label: "Valid", color: SUCCESS, icon: BadgeCheck },
  revoked: { label: "Revoked", color: DANGER, icon: Ban },
  expired: { label: "Expired", color: NEUTRAL, icon: CalendarX },
};