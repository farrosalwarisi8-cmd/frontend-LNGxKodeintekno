import type { Role } from "@/lib/types"

export type NavItem = {
  title: string
  href: string
  icon: string
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
  doctor: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "MCU Review Queue", href: "/mcu/review", icon: "stethoscope" },
    { title: "Patient Records", href: "/employees", icon: "users" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Health Certificates", href: "/certificates", icon: "badge-check" },
    { title: "Medical Reports", href: "/reports", icon: "bar-chart" },
  ],
  hr: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Employees", href: "/employees", icon: "users" },
    { title: "MCU Requests", href: "/mcu", icon: "activity" },
    { title: "Work Health Status", href: "/health-status", icon: "heart-pulse" },
    { title: "Administrative Reports", href: "/reports", icon: "bar-chart" },
  ],
  clinic: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Patient Registration", href: "/visits/new", icon: "user-plus" },
    { title: "Queue", href: "/visits/queue", icon: "list-ordered" },
    { title: "Clinic Visits", href: "/visits", icon: "clipboard-list" },
    { title: "Medicine Dispensing", href: "/medicine/dispense", icon: "pill" },
  ],
  pharmacy: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Medicine Stock", href: "/medicine", icon: "pill" },
    { title: "Dispensing", href: "/medicine/dispense", icon: "pill" },
  ],
  worker: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "My Profile", href: "/my/profile", icon: "user" },
    { title: "My MCU", href: "/my/mcu", icon: "activity" },
    { title: "My Certificates", href: "/my/certificates", icon: "badge-check" },
  ],
  management: [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Employees (Aggregate)", href: "/employees", icon: "users" },
    { title: "Work Health Status", href: "/health-status", icon: "heart-pulse" },
    { title: "Reports", href: "/reports", icon: "bar-chart" },
  ],
}

const FULL_ACCESS: Role[] = ["admin", "doctor", "clinic", "pharmacy", "hr", "worker", "management"]

export function can(role: Role, action: string): boolean {
  switch (action) {
    case "view-diagnosis":
      return role === "doctor" || role === "clinic" || role === "admin"
    case "view-clinical-notes":
      return role === "doctor" || role === "clinic" || role === "admin"
    case "set-health-status":
      return role === "doctor"
    case "review-mcu":
      return role === "doctor"
    case "issue-certificate":
      return role === "doctor"
    case "manage-stock":
      return role === "admin" || role === "pharmacy"
    case "manage-employees":
      return role === "admin" || role === "hr"
    case "manage-users":
      return role === "admin"
    case "input-mcu-result":
      return role === "admin" || role === "doctor" || role === "clinic"
    case "create-mcu":
      return role === "admin" || role === "hr" || role === "clinic"
    default:
      return FULL_ACCESS.includes(role)
  }
}
