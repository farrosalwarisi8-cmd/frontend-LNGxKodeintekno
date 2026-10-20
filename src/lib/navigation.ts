import { can, type Permission } from "../../lib/rbac";
import type { Role } from "../../lib/types";
import { isFeatureDnaEnabled, isFeatureOhReviewEnabled } from "@/lib/env";

/**
 * Konfigurasi navigasi terpusat untuk seluruh shell internal (EmrShell).
 *
 * - `permission` memakai nama aksi yang sudah ada di `lib/rbac.ts#can`.
 * - Route tanpa `permission` selalu ditampilkan (semua role / demo publik).
 * - Item `disabled` untuk fitur yang belum punya halaman (jangan diarahkan
 *   ke route lain yang salah).
 * - Item `featureFlag` disembunyikan saat flag-nya MATI (default), sehingga
 *   merge dengan flag mati tidak mengubah perilaku navigasi yang ada.
 */

/** Feature flag lingkungan yang mengendalikan visibilitas item menu. */
export type NavigationFeatureFlag = "oh-review" | "dna";

export interface NavigationItem {
  label: string;
  href: string;
  /** Nama ikon lucide yang dipetakan di shell (string agar lib ini bebas React). */
  icon: string;
  /** Aksi permission sesuai `can()` di lib/rbac. */
  permission?: Permission;
  /** Item tanpa halaman (mis. Lab & Radiologi) — tampil disabled. */
  disabled?: boolean;
  /** Aktif hanya jika pathname persis sama (mis. /dashboard). */
  end?: boolean;
  /** Item hanya tampil bila feature flag terkait aktif. */
  featureFlag?: NavigationFeatureFlag;
}

/** Apakah feature flag sebuah item menu aktif? */
export function isNavigationFeatureEnabled(flag: NavigationFeatureFlag | undefined): boolean {
  if (!flag) return true;
  if (flag === "oh-review") return isFeatureOhReviewEnabled();
  if (flag === "dna") return isFeatureDnaEnabled();
  return false;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", end: true },
  { label: "Demo", href: "/demo", icon: "flask" },
  // Registrasi & Consent (MPI Modul 01) sengaja dipisah tegas dari
  // Direktori Pekerja (/employees, data master pekerja dari backend) supaya
  // tidak ada dua menu "daftar orang" yang tampak sama.
  { label: "Registrasi & Consent", href: "/people", icon: "users", permission: "manage-employees" },
  { label: "Direktori Pekerja", href: "/employees", icon: "users", permission: "manage-employees" },
  { label: "MCU & FTW", href: "/mcu", icon: "activity", permission: "view-mcu" },
  { label: "Review MCU", href: "/mcu/review", icon: "stethoscope", permission: "review-mcu" },
  { label: "Kunjungan", href: "/visits", icon: "clipboard-list", permission: "view-visits" },
  { label: "Registrasi Kunjungan", href: "/visits/new", icon: "user-plus", permission: "register-patient" },
  { label: "Antrean", href: "/visits/queue", icon: "list-ordered", permission: "view-visits" },
  { label: "Rekam Medis", href: "/medical-records", icon: "file-text", permission: "view-clinical-notes" },
  { label: "Farmasi", href: "/medicine", icon: "pill", permission: "manage-stock" },
  { label: "Dispensing", href: "/medicine/dispense", icon: "pill", permission: "dispense-medicine" },
  { label: "Retur Obat", href: "/medicine/return", icon: "pill", permission: "dispense-medicine" },
  { label: "Sertifikat", href: "/certificates", icon: "badge-check", permission: "issue-certificate" },
  { label: "Laporan", href: "/reports", icon: "bar-chart", permission: "view-reports" },
  { label: "Status Kesehatan", href: "/health-status", icon: "heart-pulse", permission: "view-health-status" },
  { label: "Waiver", href: "/waiver", icon: "shield-check", permission: "manage-hse" },
  // D&A forensik = wewenang Dokter OH & Analis Lab (sesuai @Roles backend
  // pada modul da-test), bukan HSE yang hanya menerima hasilnya.
  { label: "D&A", href: "/da", icon: "flask", permission: "manage-da" },
  // --- A3: menu baru di balik feature flag (default mati) ----------------
  // Halaman review MCU (Dokter OH) & pratinjau resume/sertifikat.
  { label: "Review MCU Dokter OH", href: "/oh-review", icon: "stethoscope", permission: "review-mcu", featureFlag: "oh-review" },
  { label: "Restriksi Kerja (OH)", href: "/oh-review/restrictions", icon: "shield-check", permission: "manage-restriction", featureFlag: "oh-review" },
  // Modul D&A terbatas (Dokter OH; HSE hanya bila ditunjuk server).
  { label: "D&A Forensik (OH)", href: "/dna", icon: "flask", permission: "view-dna", featureFlag: "dna" },
  { label: "Emergency", href: "/emergency", icon: "alert-triangle", permission: "view-emergency" },
  // System Administrator controls
  { label: "Sistem", href: "/system-config", icon: "settings", permission: "manage-system-config" },
  { label: "API Key", href: "/api-keys", icon: "key", permission: "manage-api-keys" },
  { label: "TTE Monitoring", href: "/tte", icon: "monitor", permission: "view-tte" },
  { label: "Emergency Mode", href: "/emergency-detail", icon: "alert-triangle", permission: "monitor-emergency" },
  { label: "User", href: "/users", icon: "users", permission: "manage-users" },
  { label: "Master Data", href: "/master-data", icon: "database", permission: "manage-master-data" },
  { label: "Audit Log", href: "/audit-logs", icon: "history", permission: "view-audit-logs" },
  { label: "Lab & Radiologi", href: "/lab", icon: "flask", permission: "input-lab-result" },
  { label: "Tanda Tangan", href: "/signatures", icon: "pen-line", permission: "issue-certificate" },
  { label: "Dokumen", href: "/documents", icon: "file-text", permission: "issue-certificate" },
];

/** Label bahasa Indonesia untuk tiap route (dipakai breadcrumb). */
export const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/demo": "Demo",
  "/people": "Registrasi & Consent",
  "/people/new": "Pendaftaran Pekerja",
  "/employees": "Direktori Pekerja",
  "/mcu": "MCU & FTW",
  "/mcu/new": "Buat MCU",
  "/mcu/review": "Review MCU",
  "/visits": "Kunjungan Klinik",
  "/visits/new": "Kunjungan Baru",
  "/visits/queue": "Antrean Klinik",
  "/medical-records": "Rekam Medis",
  "/medicine": "Farmasi",
  "/medicine/dispense": "Dispensing",
  "/medicine/return": "Retur Obat",
  "/certificates": "Sertifikat",
  "/reports": "Laporan",
  "/health-status": "Status Kesehatan",
  "/waiver": "Waiver",
  "/da": "Drug & Alcohol",
  "/oh-review": "Review MCU Dokter OH",
  "/oh-review/restrictions": "Restriksi Kerja",
  "/dna": "D&A Forensik",
  "/emergency": "Emergency",
  "/users": "Pengguna",
  "/master-data": "Master Data",
  "/audit-logs": "Audit Log",
  "/lab": "Lab & Radiologi",
  "/signatures": "Tanda Tangan",
  "/documents": "Dokumen",
  "/my": "Akun Saya",
  "/my/profile": "Profil Saya",
  "/my/mcu": "MCU Saya",
  "/my/certificates": "Sertifikat Saya",
  "/my/notifications": "Notifikasi Saya",
};

const SEGMENT_FALLBACK: Record<string, string> = {
  new: "Baru",
  review: "Review",
  queue: "Antrean",
  dispense: "Dispensing",
  profile: "Profil",
  mcu: "MCU",
  certificates: "Sertifikat",
  "oh-review": "Review MCU",
  restrictions: "Restriksi Kerja",
  dna: "D&A",
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
 * - `role=null` (belum/tidak login) → tidak ada item.
 * - Item `disabled` selalu tampil (sebagai menu nonaktif "Segera hadir").
 */
export function getNavigation(role: Role | null | undefined): NavigationItem[] {
  if (!role) return [];
  return NAVIGATION_ITEMS.filter((i) => {
    if (i.featureFlag && !isNavigationFeatureEnabled(i.featureFlag)) return false;
    if (!i.permission) return true;
    return can(role, i.permission);
  });
}

/**
 * Mobile bottom navigation.
 *
 * Memakai registry permission yang SAMA dengan sidebar & route guard —
 * tidak ada mapping permission kedua. Item difilter dari `NAVIGATION_ITEMS`
 * supaya urutan dan permission tidak pernah menyimpang dari sidebar.
 */
export const BOTTOM_NAV_ITEMS: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", permission: "view-dashboard", end: true },
  { label: "MCU", href: "/mcu", icon: "activity", permission: "view-mcu" },
  { label: "Kunjungan", href: "/visits", icon: "clipboard-list", permission: "view-visits" },
  { label: "Farmasi", href: "/medicine", icon: "pill", permission: "manage-stock" },
];

const BOTTOM_NAV_HREFS = new Set(BOTTOM_NAV_ITEMS.map((i) => i.href));
// Label ringkas khusus bottom bar ("MCU & FTW" → "MCU") — hanya presentasi;
// permission tetap berasal dari NAVIGATION_ITEMS/getNavigation().
const BOTTOM_NAV_LABELS = new Map(BOTTOM_NAV_ITEMS.map((i) => [i.href, i.label]));

/** Item bottom navigation yang boleh diakses role (maksimal sepanjang daftar). */
export function getBottomNavigation(role: Role | null | undefined): NavigationItem[] {
  return getNavigation(role)
    .filter((i) => BOTTOM_NAV_HREFS.has(i.href))
    .map((i) => ({ ...i, label: BOTTOM_NAV_LABELS.get(i.href) ?? i.label }));
}

/** Item yang TIDAK ditampilkan di bottom navigation (dipakai tombol "Lainnya"). */
export function getOverflowNavigation(role: Role | null | undefined): NavigationItem[] {
  return getNavigation(role).filter((i) => !BOTTOM_NAV_HREFS.has(i.href));
}

/**
 * Redirect setelah login: hanya menerima path internal, selain itu /dashboard.
 * Blokir redirect eksternal (protocol-relative, absolute URL).
 */
export function resolveLoginRedirect(from: string | null | undefined): string {
  if (!from) return "/dashboard";
  if (!from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) {
    return "/dashboard";
  }
  return from;
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
