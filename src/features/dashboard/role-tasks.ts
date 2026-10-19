import { can, type Permission } from "../../../lib/rbac";
import type { Role } from "../../../lib/types";

/**
 * Profil dashboard per peran — satu sumber untuk "tindakan yang paling sering
 * dipakai" dan angka yang paling relevan bagi peran tersebut.
 *
 * Kenapa di sini dan bukan di komponen: profil ini murni data (bisa diuji tanpa
 * React/backend) dan dipakai dua tempat — daftar tindakan cepat di dashboard dan
 * uji skenario per peran. Semua `permission` memakai registry `lib/rbac.ts`,
 * jadi menu dan tindakan tidak pernah menyimpang dari otorisasi frontend.
 *
 * Catatan: ini lapisan UX. Otorisasi sebenarnya tetap milik backend.
 */

/** Angka/kartu yang bisa ditampilkan dashboard (dihitung dari store). */
export type DashboardTileKey =
  | "employees"
  | "pendingMcu"
  | "mcuDueSoon"
  | "visitsToday"
  | "queueWaiting"
  | "validCerts"
  | "fitToWork"
  | "fitWithRestriction"
  | "restricted"
  | "lowStock"
  | "pendingPrescriptions"
  | "myFitStatus"
  | "myNextMcu";

export interface RoleTask {
  /** Label tombol — memakai kata kerja yang jelas (bukan "Kelola"). */
  label: string;
  href: string;
  /** Nama ikon lucide (string agar berkas ini bebas React). */
  icon: string;
  /** Satu kalimat penjelas: kenapa tindakan ini muncul untuk peran ini. */
  description: string;
  permission?: Permission;
}

export interface RoleDashboardProfile {
  /** Kalimat ringkas tujuan peran hari ini. */
  focus: string;
  /** Tindakan cepat, urut dari yang paling sering dipakai. */
  tasks: RoleTask[];
  /** Kartu angka yang ditampilkan, urut prioritas. */
  tiles: DashboardTileKey[];
  /** Layout ringkas (mobile-first, satu kolom) untuk pekerja. */
  compact?: boolean;
}

const CLINIC_INTAKE: RoleTask[] = [
  {
    label: "Kunjungan baru",
    href: "/visits/new",
    icon: "user-plus",
    description: "Daftarkan pasien dan catat TTV",
    permission: "register-patient",
  },
  {
    label: "Antrean",
    href: "/visits/queue",
    icon: "list-ordered",
    description: "Panggil pasien berikutnya",
    permission: "view-visits",
  },
  {
    label: "MCU baru",
    href: "/mcu/new",
    icon: "activity",
    description: "Catat TTV & hasil pemeriksaan MCU",
    permission: "create-mcu",
  },
  {
    label: "Riwayat kunjungan",
    href: "/visits",
    icon: "clipboard-list",
    description: "Lihat kunjungan yang sedang berjalan",
    permission: "view-visits",
  },
  {
    label: "Status kesehatan",
    href: "/health-status",
    icon: "heart-pulse",
    description: "Cek Fitness to Work pekerja",
    permission: "view-health-status",
  },
];

const DOCTOR_TASKS: RoleTask[] = [
  {
    label: "Tulis SOAP",
    href: "/medical-records",
    icon: "file-text",
    description: "Isi SOAP, diagnosis ICD-10, lalu kunci rekam medis",
    permission: "view-clinical-notes",
  },
  {
    label: "Review MCU",
    href: "/mcu/review",
    icon: "stethoscope",
    description: "Setujui MCU yang menunggu dokter",
    permission: "review-mcu",
  },
  {
    label: "Sertifikat",
    href: "/certificates",
    icon: "badge-check",
    description: "Terbitkan sertifikat kesehatan kerja",
    permission: "issue-certificate",
  },
  {
    label: "Status kesehatan",
    href: "/health-status",
    icon: "heart-pulse",
    description: "Tetapkan FTW & restriction",
    permission: "view-health-status",
  },
  {
    label: "Hasil lab",
    href: "/lab",
    icon: "flask",
    description: "Baca hasil lab & radiologi",
    permission: "input-lab-result",
  },
];

const DOCTOR_CLINIC_TASKS: RoleTask[] = [
  DOCTOR_TASKS[0],
  {
    label: "Kunjungan baru",
    href: "/mcu/new",
    icon: "activity",
    description: "Buka siklus MCU untuk pasien klinik",
    permission: "create-mcu",
  },
  {
    label: "Daftar kunjungan",
    href: "/visits",
    icon: "clipboard-list",
    description: "Kunjungan klinik yang sedang berjalan",
    permission: "view-visits",
  },
  DOCTOR_TASKS[3],
  {
    label: "MCU & FTW",
    href: "/mcu",
    icon: "activity",
    description: "Siklus MCU pekerja",
    permission: "view-mcu",
  },
];

const PHARMACY_TASKS: RoleTask[] = [
  {
    label: "Dispensing",
    href: "/medicine/dispense",
    icon: "pill",
    description: "Proses resep menunggu (FEFO)",
    permission: "dispense-medicine",
  },
  {
    label: "Retur obat",
    href: "/medicine/return",
    icon: "undo-2",
    description: "Catat obat yang dikembalikan",
    permission: "dispense-medicine",
  },
  {
    label: "Stok & FEFO",
    href: "/medicine",
    icon: "package",
    description: "Pantau stok rendah dan batch mendekati kadaluarsa",
    permission: "manage-stock",
  },
];

const HSE_TASKS: RoleTask[] = [
  {
    label: "Status kesehatan",
    href: "/health-status",
    icon: "heart-pulse",
    description: "Pantau FTW, restriction, dan MCU jatuh tempo",
    permission: "view-health-status",
  },
  {
    label: "Waiver",
    href: "/waiver",
    icon: "shield-check",
    description: "Kelola pengajuan waiver HSE",
    permission: "manage-hse",
  },
  {
    label: "Laporan",
    href: "/reports",
    icon: "bar-chart",
    description: "Unduh laporan kesehatan kerja",
    permission: "view-reports",
  },
  {
    label: "MCU & FTW",
    href: "/mcu",
    icon: "activity",
    description: "Lihat siklus MCU pekerja",
    permission: "view-mcu",
  },
];

const HR_TASKS: RoleTask[] = [
  {
    label: "MCU jatuh tempo",
    href: "/health-status?filter=due-soon",
    icon: "clock",
    description: "Pekerja yang MCU-nya harus dijadwalkan",
    permission: "view-health-status",
  },
  {
    label: "Direktori pekerja",
    href: "/employees",
    icon: "users",
    description: "Cari pekerja, kontak, dan riwayat MCU",
    permission: "manage-employees",
  },
  {
    label: "Laporan",
    href: "/reports",
    icon: "bar-chart",
    description: "Ekspor rekap untuk manajemen",
    permission: "view-reports",
  },
  {
    label: "MCU & FTW",
    href: "/mcu",
    icon: "activity",
    description: "Status siklus MCU seluruh pekerja",
    permission: "view-mcu",
  },
];

const WORKER_TASKS: RoleTask[] = [
  {
    label: "Status kesehatan saya",
    href: "/my/mcu",
    icon: "activity",
    description: "Fitness to Work & hasil MCU terakhir",
    permission: "view-mcu",
  },
  {
    label: "Sertifikat saya",
    href: "/my/certificates",
    icon: "badge-check",
    description: "Unduh sertifikat kesehatan kerja",
    permission: "view-mcu",
  },
  {
    label: "Notifikasi saya",
    href: "/my/notifications",
    icon: "bell",
    description: "Pengingat MCU dan surat",
    permission: "view-profile",
  },
  {
    label: "Profil saya",
    href: "/my/profile",
    icon: "user-round",
    description: "Periksa data pribadi & kontak",
    permission: "view-profile",
  },
];

export const ROLE_TASK_PROFILES: Record<Role, RoleDashboardProfile> = {
  "admin-klinik": {
    focus: "Layani pendaftaran dan antrean secepat mungkin.",
    tasks: CLINIC_INTAKE,
    tiles: ["queueWaiting", "visitsToday", "pendingMcu", "pendingPrescriptions", "lowStock", "employees"],
  },
  perawat: {
    focus: "Siapkan pasien: registrasi, antrean, dan TTV.",
    tasks: CLINIC_INTAKE,
    tiles: ["queueWaiting", "visitsToday", "pendingMcu", "mcuDueSoon", "fitWithRestriction", "employees"],
  },
  "dokter-oh": {
    focus: "Selesaikan SOAP dan review MCU hari ini.",
    tasks: DOCTOR_TASKS,
    tiles: ["pendingMcu", "visitsToday", "mcuDueSoon", "restricted", "validCerts", "pendingPrescriptions"],
  },
  "dokter-klinik": {
    focus: "Tulis SOAP pasien klinik, lalu kunci rekam medis.",
    tasks: DOCTOR_CLINIC_TASKS,
    tiles: ["visitsToday", "pendingMcu", "mcuDueSoon", "restricted", "fitWithRestriction"],
  },
  apoteker: {
    focus: "Dispensing resep dengan perhatian pada stok dan FEFO.",
    tasks: PHARMACY_TASKS,
    tiles: ["pendingPrescriptions", "lowStock", "queueWaiting", "visitsToday"],
  },
  hr: {
    focus: "Pastikan MCU pekerja tidak lewat jatuh tempo.",
    tasks: HR_TASKS,
    tiles: ["mcuDueSoon", "pendingMcu", "employees", "fitToWork", "restricted", "fitWithRestriction"],
  },
  hse: {
    focus: "Pantau FTW, restriction, dan MCU jatuh tempo.",
    tasks: HSE_TASKS,
    tiles: ["restricted", "mcuDueSoon", "fitWithRestriction", "fitToWork", "pendingMcu", "visitsToday"],
  },
  manajemen: {
    focus: "Lihat ringkasan kesehatan kerja seluruh site.",
    tasks: [
      {
        label: "Laporan",
        href: "/reports",
        icon: "bar-chart",
        description: "Rekap MCU, FTW, dan kunjungan",
        permission: "view-reports",
      },
      {
        label: "Status kesehatan",
        href: "/health-status",
        icon: "heart-pulse",
        description: "Distribusi Fitness to Work",
        permission: "view-health-status",
      },
      {
        label: "Kunjungan",
        href: "/visits",
        icon: "clipboard-list",
        description: "Volume kunjungan klinik",
        permission: "view-visits",
      },
    ],
    tiles: ["fitToWork", "fitWithRestriction", "restricted", "mcuDueSoon", "visitsToday", "employees"],
  },
  lab: {
    focus: "Masukkan hasil lab dan D&A tepat waktu.",
    tasks: [
      {
        label: "Input hasil lab",
        href: "/lab",
        icon: "flask",
        description: "Catat hasil laboratorium & radiologi",
        permission: "input-lab-result",
      },
      {
        label: "D&A",
        href: "/da",
        icon: "flask",
        description: "Catat hasil Drug & Alcohol",
        permission: "manage-da",
      },
      {
        // A1: pintasan MCU dihapus dari role lab (view-mcu dicabut);
        // gantinya laporan yang memang boleh dilihat analis lab.
        label: "Laporan",
        href: "/reports",
        icon: "bar-chart",
        description: "Rekap hasil lab & radiologi",
        permission: "view-reports",
      },
    ],
    tiles: ["pendingMcu", "mcuDueSoon", "visitsToday", "employees"],
  },
  admin: {
    focus: "Jaga data induk dan akses pengguna tetap rapi.",
    tasks: [
      {
        label: "Pengguna",
        href: "/users",
        icon: "users",
        description: "Kelola akun dan peran",
        permission: "manage-users",
      },
      {
        label: "Master data",
        href: "/master-data",
        icon: "database",
        description: "Site, unit, job task, katalog ICD-10",
        permission: "manage-master-data",
      },
      {
        label: "Registrasi & consent",
        href: "/people",
        icon: "user-plus",
        description: "Pendaftaran pekerja dan consent digital",
        permission: "manage-employees",
      },
      {
        label: "Audit log",
        href: "/audit-logs",
        icon: "history",
        description: "Telusuri aktivitas sistem",
        permission: "view-audit-logs",
      },
      {
        label: "Status kesehatan",
        href: "/health-status",
        icon: "heart-pulse",
        description: "Pantau FTW seluruh site",
        permission: "view-health-status",
      },
    ],
    tiles: ["employees", "pendingMcu", "visitsToday", "queueWaiting", "lowStock", "validCerts"],
  },
  pekerja: {
    focus: "Lihat status kesehatan dan dokumen Anda.",
    tasks: WORKER_TASKS,
    tiles: ["myFitStatus", "myNextMcu", "validCerts", "pendingMcu"],
    compact: true,
  },
};

/** Profil untuk role yang belum terdaftar (jangan pernah kosong). */
const FALLBACK_PROFILE: RoleDashboardProfile = {
  focus: "Ringkasan aktivitas klinik.",
  tasks: CLINIC_INTAKE,
  tiles: ["visitsToday", "pendingMcu", "employees"],
};

export function getRoleDashboard(role: Role | null | undefined): RoleDashboardProfile {
  if (!role) return { ...FALLBACK_PROFILE, tasks: [] };
  return ROLE_TASK_PROFILES[role] ?? FALLBACK_PROFILE;
}

/**
 * Tindakan cepat yang boleh dilihat role — disaring lewat registry permission
 * yang sama dengan menu, route guard, dan tombol (`components/can.tsx`).
 */
export function getRoleTasks(role: Role | null | undefined): RoleTask[] {
  if (!role) return [];
  return getRoleDashboard(role).tasks.filter((t) => !t.permission || can(role, t.permission));
}

/**
 * Tautan `/my/*` untuk pekerja. Tidak memakai permission karena halaman ini
 * hanya menampilkan data milik akun yang sedang login.
 */
export function getWorkerHomeLinks(): { label: string; href: string; icon: string; description: string }[] {
  return WORKER_TASKS.map(({ label, href, icon, description }) => ({
    label,
    href,
    icon,
    description,
  }));
}
