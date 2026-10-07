import { can } from "../../lib/rbac";
import type { Role } from "../../lib/types";

/**
 * Konfigurasi navigasi terpusat untuk seluruh shell internal (EmrShell).
 *
 * - `permission` memakai nama aksi yang sudah ada di `lib/rbac.ts#can`.
 * - Route tanpa `permission` selalu ditampilkan (semua role / demo publik).
 * - Item `disabled` untuk fitur yang belum punya halaman (jangan diarahkan
 *   ke route lain yang salah).
 */

export interface NavigationItem {
  label: string;
  href: string;
  /** Nama ikon lucide yang dipetakan di shell (string agar lib ini bebas React). */
  icon: string;
  /** Aksi permission sesuai `can()` di lib/rbac. */
  permission?: string;
  /** Item tanpa halaman (mis. Lab & Radiologi) — tampil disabled. */
  disabled?: boolean;
  /** Aktif hanya jika pathname persis sama (mis. /dashboard). */
  end?: boolean;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", end: true },
  { label: "Demo", href: "/demo", icon: "flask" },
  { label: "People", href: "/people", icon: "users" },
  { label: "Pekerja", href: "/employees", icon: "users" },
  { label: "MCU & FTW", href: "/mcu", icon: "activity" },
  { label: "Review MCU", href: "/mcu/review", icon: "stethoscope", permission: "review-mcu" },
  { label: "Kunjungan", href: "/visits", icon: "clipboard-list" },
  { label: "Registrasi Kunjungan", href: "/visits/new", icon: "user-plus", permission: "register-patient" },
  { label: "Antrean", href: "/visits/queue", icon: "list-ordered" },
  { label: "Rekam Medis", href: "/medical-records", icon: "file-text" },
  { label: "Farmasi", href: "/medicine", icon: "pill" },
  { label: "Dispensing", href: "/medicine/dispense", icon: "pill", permission: "dispense-medicine" },
  { label: "Sertifikat", href: "/certificates", icon: "badge-check" },
  { label: "Laporan", href: "/reports", icon: "bar-chart" },
  { label: "Status Kesehatan", href: "/health-status", icon: "heart-pulse" },
  { label: "Waiver", href: "/waiver", icon: "shield-check" },
  { label: "D&A", href: "/da", icon: "flask" },
  { label: "Emergency", href: "/emergency", icon: "alert-triangle" },
  { label: "User", href: "/users", icon: "users", permission: "manage-users" },
  { label: "Master Data", href: "/master-data", icon: "database" },
  { label: "Audit Log", href: "/audit-logs", icon: "history" },
  // Halaman Lab & Radiologi belum ada — tampil disabled, jangan diarahkan ke /mcu.
  { label: "Lab & Radiologi", href: "/lab", icon: "flask", disabled: true },
];

/** Label bahasa Indonesia untuk tiap route (dipakai breadcrumb). */
export const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/demo": "Demo",
  "/people": "People",
  "/employees": "Pekerja",
  "/mcu": "MCU & FTW",
  "/mcu/new": "Buat MCU",
  "/mcu/review": "Review MCU",
  "/visits": "Kunjungan Klinik",
  "/visits/new": "Kunjungan Baru",
  "/visits/queue": "Antrean Klinik",
  "/medical-records": "Rekam Medis",
  "/medicine": "Farmasi",
  "/medicine/dispense": "Dispensing",
  "/certificates": "Sertifikat",
  "/reports": "Laporan",
  "/health-status": "Status Kesehatan",
  "/waiver": "Waiver",
  "/da": "Drug & Alcohol",
  "/emergency": "Emergency",
  "/users": "Pengguna",
  "/master-data": "Master Data",
  "/audit-logs": "Audit Log",
  "/my": "Profil Saya",
  "/my/profile": "Profil Saya",
  "/my/mcu": "MCU Saya",
  "/my/certificates": "Sertifikat Saya",
};

const SEGMENT_FALLBACK: Record<string, string> = {
  new: "Baru",
  review: "Review",
  queue: "Antrean",
  dispense: "Dispensing",
  profile: "Profil",
  mcu: "MCU",
  certificates: "Sertifikat",
  "": "Beranda",
};

function humanize(segment: string): string {
  const known = SEGMENT_FALLBACK[segment];
  if (known) return known;
  return segment
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/**
 * Menyaring navigasi berdasarkan role (permission `can()` di lib/rbac).
 * - `role=null` (demo publik / belum login) → semua item tampil.
 * - Item `disabled` selalu tampil (sebagai menu nonaktif “Segera hadir”).
 */
export function getNavigation(role: Role | null | undefined): NavigationItem[] {
  if (!role) return NAVIGATION_ITEMS;
  return NAVIGATION_ITEMS.filter((i) => {
    if (!i.permission) return true;
    return can(role, i.permission);
  });
}

/**
 * Deteksi route aktif. Parent aktif jika child aktif, kecuali `end`
 * (mis. /dashboard hanya aktif persis di /dashboard).
 */
export function isNavActive(pathname: string, href: string, end = false): boolean {
  if (end) return pathname === href;
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface BreadcrumbItem {
  label: string;
  href?: string; // halaman aktif tidak punya href (bukan link)
}

/**
 * Membangun breadcrumb dari pathname.
 * Contoh: /mcu/review -> Dashboard? tidak; -> [{MCU & FTW, /mcu}, {Review MCU}]
 * Route dikenal memakai ROUTE_LABELS; segmen tak dikenal di-humanize.
 */
export function buildBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return [{ label: "Dashboard" }];
  if (ROUTE_LABELS[clean] && clean.split("/").length === 2) {
    // route satu tingkat: tampil sebagai halaman aktif tanpa link induk
    return [{ label: ROUTE_LABELS[clean] }];
  }

  const segments = clean.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let acc = "";

  for (let i = 0; i < segments.length; i++) {
    acc += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const label = ROUTE_LABELS[acc] ?? humanize(segments[i]);
    if (isLast) {
      items.push({ label });
    } else {
      items.push({ label, href: acc });
    }
  }
  return items;
}

/** Redirect setelah login: hanya menerima path internal, selain itu /dashboard. */
export function resolveLoginRedirect(from: string | null | undefined): string {
  if (!from) return "/dashboard";
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
    return "/dashboard";
  }
  return from;
}
