import type { Role } from "@/lib/types"

export type NavItem = {
  title: string
  href: string
  icon: string
  /** Item tanpa halaman — ditampilkan disabled, bukan diarahkan ke route lain. */
  disabled?: boolean
}

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Employees", href: "/employees", icon: "users" },
    { title: "MCU", href: "/mcu", icon: "activity" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Medical Records", href: "/medical-records", icon: "file-text" },
    { title: "Medicine Stock", href: "/medicine", icon: "pill" },
    { title: "Health Certificates", href: "/certificates", icon: "badge-check" },
    { title: "Reports & Analytics", href: "/reports", icon: "bar-chart" },
    { title: "Users & Roles", href: "/users", icon: "shield-check" },
    { title: "Master Data", href: "/master-data", icon: "database" },
    { title: "Audit Logs", href: "/audit-logs", icon: "history" },
  ],
  "dokter-oh": [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "MCU Review Queue", href: "/mcu/review", icon: "stethoscope" },
    { title: "Patient Records", href: "/employees", icon: "users" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Health Certificates", href: "/certificates", icon: "badge-check" },
    { title: "Medical Reports", href: "/reports", icon: "bar-chart" },
  ],
  "dokter-klinik": [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Queue", href: "/visits/queue", icon: "list-ordered" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Patient Records", href: "/employees", icon: "users" },
    { title: "Diagnosis", href: "/master-data", icon: "database" },
  ],
  perawat: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Patient Registration", href: "/visits/new", icon: "user-plus" },
    { title: "Queue", href: "/visits/queue", icon: "list-ordered" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Vitals", href: "/visits", icon: "heart-pulse" },
  ],
  apoteker: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Medicine Stock", href: "/medicine", icon: "pill" },
    { title: "Dispensing", href: "/medicine/dispense", icon: "pill" },
    { title: "Stock Opname", href: "/medicine", icon: "database" },
  ],
  lab: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Lab Orders", href: "/lab", icon: "activity", disabled: true },
    { title: "Lab Results", href: "/lab", icon: "file-text", disabled: true },
    { title: "Radiology", href: "/lab", icon: "activity", disabled: true },
  ],
  "admin-klinik": [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Patient Registration", href: "/visits/new", icon: "user-plus" },
    { title: "Queue", href: "/visits/queue", icon: "list-ordered" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Medicine Dispensing", href: "/medicine/dispense", icon: "pill" },
  ],
  hr: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Employees", href: "/employees", icon: "users" },
    { title: "MCU Requests", href: "/mcu", icon: "activity" },
    { title: "Work Health Status", href: "/health-status", icon: "heart-pulse" },
    { title: "Administrative Reports", href: "/reports", icon: "bar-chart" },
  ],
  hse: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Work Health Status", href: "/health-status", icon: "heart-pulse" },
    { title: "Employees (Aggregate)", href: "/employees", icon: "users" },
    { title: "Reports", href: "/reports", icon: "bar-chart" },
  ],
  manajemen: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Employees (Aggregate)", href: "/employees", icon: "users" },
    { title: "Work Health Status", href: "/health-status", icon: "heart-pulse" },
    { title: "Reports", href: "/reports", icon: "bar-chart" },
  ],
  pekerja: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "My Profile", href: "/my/profile", icon: "user" },
    { title: "My MCU", href: "/my/mcu", icon: "activity" },
    { title: "My Certificates", href: "/my/certificates", icon: "badge-check" },
  ],
}

const FULL_ACCESS: Role[] = [
  "admin",
  "dokter-oh",
  "dokter-klinik",
  "perawat",
  "apoteker",
  "lab",
  "admin-klinik",
  "hr",
  "hse",
  "manajemen",
  "pekerja",
]

export function can(role: Role, action: string): boolean {
  switch (action) {
    case "view-diagnosis":
      return ["dokter-oh", "dokter-klinik", "perawat", "admin"].includes(role)
    case "view-clinical-notes":
      return ["dokter-oh", "dokter-klinik", "perawat", "admin"].includes(role)
    case "set-health-status":
      return ["dokter-oh"].includes(role)
    case "review-mcu":
      return ["dokter-oh"].includes(role)
    case "issue-certificate":
      return ["dokter-oh"].includes(role)
    case "manage-stock":
      return ["admin", "apoteker"].includes(role)
    case "manage-employees":
      return ["admin", "hr"].includes(role)
    case "manage-users":
      return ["admin"].includes(role)
    case "input-mcu-result":
      return ["admin", "dokter-oh", "dokter-klinik", "perawat", "lab"].includes(role)
    case "create-mcu":
      return ["admin", "hr", "admin-klinik", "perawat"].includes(role)
    case "input-lab-result":
      return ["lab", "dokter-oh", "admin"].includes(role)
    case "dispense-medicine":
      return ["apoteker", "admin-klinik", "admin"].includes(role)
    case "register-patient":
      return ["admin-klinik", "perawat", "admin"].includes(role)
    case "manage-hse":
      return ["hse", "admin"].includes(role)
    default:
      return FULL_ACCESS.includes(role)
  }
}
