import type { HealthStatus, MCUType, EmployeeStatus, Role } from "@/lib/types"

/*
 * Peta status klinis pindah ke `lib/status-map.ts` (satu berkas, lengkap
 * dengan ikon + label). Ekspor di sini dipertahankan agar seluruh konsumen
 * yang sudah ada tidak perlu mengubah jalur impornya.
 */
export { MCU_STATUS, HEALTH_STATUS, VISIT_STATUS, EMPLOYEE_STATUS, CERT_STATUS } from "@/lib/status-map";
export type { StatusMeta } from "@/lib/status-map";

export const ROLES: Record<Role, { label: string; color: string }> = {
  // Chip peran memakai nada netral: warna bermakna disisihkan untuk status
  // klinis (hijau = Fit/selesai, merah = Unfit/bahaya, biru = informasi),
  // sehingga peran tidak pernah bersaing arti dengan status pasien.
  admin: { label: "Admin Sistem", color: "bg-muted text-text-secondary" },
  "dokter-oh": { label: "Dokter OH", color: "bg-muted text-text-secondary" },
  "dokter-klinik": { label: "Dokter Klinik", color: "bg-muted text-text-secondary" },
  perawat: { label: "Perawat", color: "bg-muted text-text-secondary" },
  apoteker: { label: "Apoteker", color: "bg-muted text-text-secondary" },
  lab: { label: "Analis Lab/Radiolog", color: "bg-muted text-text-secondary" },
  "admin-klinik": { label: "Admin Klinik", color: "bg-muted text-text-secondary" },
  hr: { label: "HR/PIC", color: "bg-muted text-text-secondary" },
  hse: { label: "HSE/Line Mgmt", color: "bg-muted text-text-secondary" },
  manajemen: { label: "Manajemen", color: "bg-muted text-text-secondary" },
  pekerja: { label: "Pekerja", color: "bg-muted text-text-secondary" },
}

export const MCU_TYPES: MCUType[] = [
  "Pre-Employment",
  "Periodic",
  "Return to Work",
  "Special",
]

export const HEALTH_STATUS_OPTIONS: HealthStatus[] = [
  "Fit to Work",
  "Fit with Restriction",
  "Temporarily Unfit",
  "Pending Further Evaluation",
  "Unfit",
]

export const GENDERS = ["Male", "Female"] as const

export const EMPLOYEE_STATUS_OPTIONS: EmployeeStatus[] = [
  "Active",
  "Inactive",
  "Mutated",
  "Contract Ended",
]

export const LOCATION_TYPES: Record<string, string> = {
  office: "Office",
  onshore: "Onshore",
  offshore: "Offshore",
}

export const LANGUAGES = [
  { code: "id" as const, label: "Indonesia" },
  { code: "en" as const, label: "English" },
  { code: "zh" as const, label: "中文" },
]
