import type { HealthStatus, MCUStatus, MCUType, VisitStatus, EmployeeStatus } from "@/lib/types"

export const ROLES = {
  admin: { label: "Admin Sistem", color: "bg-violet-100 text-violet-700" },
  doctor: { label: "Dokter", color: "bg-emerald-100 text-emerald-700" },
  clinic: { label: "Petugas Klinik", color: "bg-sky-100 text-sky-700" },
  pharmacy: { label: "Petugas Farmasi", color: "bg-amber-100 text-amber-700" },
  hr: { label: "HR", color: "bg-blue-100 text-blue-700" },
  worker: { label: "Pekerja", color: "bg-slate-100 text-slate-700" },
  management: { label: "Manajemen", color: "bg-rose-100 text-rose-700" },
} as const

export const MCU_STATUS: Record<MCUStatus, { label: string; color: string }> = {
  Draft: { label: "Draft", color: "bg-slate-100 text-slate-600" },
  Submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700" },
  "Under Review": { label: "Under Review", color: "bg-amber-100 text-amber-700" },
  "Revision Required": { label: "Revision Required", color: "bg-orange-100 text-orange-700" },
  Resubmitted: { label: "Resubmitted", color: "bg-indigo-100 text-indigo-700" },
  Approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700" },
  Rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  Closed: { label: "Closed", color: "bg-slate-100 text-slate-600" },
}

export const HEALTH_STATUS: Record<HealthStatus, { label: string; color: string }> = {
  "Fit to Work": { label: "Fit to Work", color: "bg-emerald-100 text-emerald-700" },
  "Fit with Restriction": { label: "Fit with Restriction", color: "bg-amber-100 text-amber-700" },
  "Temporarily Unfit": { label: "Temporarily Unfit", color: "bg-orange-100 text-orange-700" },
  "Pending Further Evaluation": { label: "Pending Further Evaluation", color: "bg-blue-100 text-blue-700" },
  Unfit: { label: "Unfit", color: "bg-red-100 text-red-700" },
}

export const VISIT_STATUS: Record<VisitStatus, { label: string; color: string }> = {
  Registered: { label: "Registered", color: "bg-slate-100 text-slate-600" },
  "In Queue": { label: "In Queue", color: "bg-blue-100 text-blue-700" },
  "In Consultation": { label: "In Consultation", color: "bg-amber-100 text-amber-700" },
  "Awaiting Pharmacy": { label: "Awaiting Pharmacy", color: "bg-indigo-100 text-indigo-700" },
  Completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
  Referred: { label: "Referred", color: "bg-orange-100 text-orange-700" },
}

export const EMPLOYEE_STATUS: Record<EmployeeStatus, { label: string; color: string }> = {
  Active: { label: "Active", color: "bg-emerald-100 text-emerald-700" },
  Inactive: { label: "Inactive", color: "bg-slate-100 text-slate-600" },
  Mutated: { label: "Mutated", color: "bg-blue-100 text-blue-700" },
  "Contract Ended": { label: "Contract Ended", color: "bg-red-100 text-red-700" },
}

export const CERT_STATUS: Record<string, { label: string; color: string }> = {
  valid: { label: "Valid", color: "bg-emerald-100 text-emerald-700" },
  revoked: { label: "Revoked", color: "bg-red-100 text-red-700" },
  expired: { label: "Expired", color: "bg-slate-100 text-slate-600" },
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
