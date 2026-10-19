import type { Role } from "@/lib/types";

// ---------------------------------------------------------------------------
// Unified Permission Registry
//
// SATU-SATUNYA sumber permission frontend. Dipakai oleh:
//   - route guard      (components/route-guard.tsx)
//   - navigasi shell   (src/lib/navigation.ts)
//   - action/tombol    (lib/actions.ts + components/can.tsx)
//
// Catatan: permission frontend hanya mengatur tampilan/UX. Otorisasi sebenarnya
// tetap milik backend (lihat ACCESS_ARCHITECTURE.md).
// ---------------------------------------------------------------------------

export type Permission =
  | "view-dashboard"
  | "manage-employees"
  | "upload-document"
  | "view-mcu"
  | "review-mcu"
  | "approve-mcu"
  | "create-mcu"
  | "input-mcu-result"
  | "view-visits"
  | "register-patient"
  | "edit-visit"
  | "view-clinical-notes"
  | "view-diagnosis"
  | "manage-stock"
  | "dispense-medicine"
  | "issue-certificate"
  | "view-reports"
  | "export-reports"
  | "view-health-status"
  | "set-health-status"
  | "acknowledge-restriction"
  | "manage-users"
  | "manage-master-data"
  | "view-audit-logs"
  | "manage-hse"
  | "view-emergency"
  | "view-profile"
  | "input-lab-result";

/** Semua permission yang dikenal (dipakai untuk validasi, test, & generator docs). */
export const ALL_PERMISSIONS: readonly Permission[] = [
  "view-dashboard",
  "manage-employees",
  "upload-document",
  "view-mcu",
  "review-mcu",
  "approve-mcu",
  "create-mcu",
  "input-mcu-result",
  "view-visits",
  "register-patient",
  "edit-visit",
  "view-clinical-notes",
  "view-diagnosis",
  "manage-stock",
  "dispense-medicine",
  "issue-certificate",
  "view-reports",
  "export-reports",
  "view-health-status",
  "set-health-status",
  "acknowledge-restriction",
  "manage-users",
  "manage-master-data",
  "view-audit-logs",
  "manage-hse",
  "view-emergency",
  "view-profile",
  "input-lab-result",
];

// ---------------------------------------------------------------------------
// A1 — Matriks permission diselaraskan dengan proposal (lihat LAPORAN_A1_
// STABILISASI_FASE2_4.md). Setiap perubahan punya alasan yang tercatat.
//
// `admin` = System Administrator: konfigurasi sistem, kelola user & role,
// audit log (read-only), monitoring. TIDAK ada akses data klinis.
// `admin-klinik` = registrasi/antrean/berobat luar klinik, TANPA data klinis.
// `hr` = HR/PIC: hanya data pekerja + status kepatuhan (MCU/FTW/restriction).
// `lab` = Analis Lab/Radiolog: hanya data penunjang.
// ---------------------------------------------------------------------------
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // System Administrator —Proposal: "konfigurasi sistem, kelola user dan
  // role, monitor sertifikat TTE dan Emergency Mode. Tidak punya akses data
  // klinis." Semua permission klinis (termasuk read-only) dicabut.
  admin: [
    "view-dashboard",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
    "manage-users",
    "manage-master-data",
    "view-audit-logs",
    "manage-hse",
  ],
  "dokter-oh": [
    "view-dashboard",
    "view-mcu",
    "review-mcu",
    "approve-mcu",
    "input-mcu-result",
    "view-visits",
    "edit-visit",
    "view-clinical-notes",
    "view-diagnosis",
    "issue-certificate",
    "view-reports",
    "export-reports",
    "view-health-status",
    "set-health-status",
    "view-emergency",
    "view-profile",
    "input-lab-result",
  ],
  "dokter-klinik": [
    "view-dashboard",
    "view-mcu",
    // Backend mengizinkan DOCTOR_CLINIC pada POST /mcu/cycles (lihat
    // API_ENDPOINTS.md + ROLE_MAPPING.md: create-mcu ✓), sehingga UI tidak boleh
    // mengunci role ini dari route /mcu/new.
    "create-mcu",
    "input-mcu-result",
    "view-visits",
    "edit-visit",
    "view-clinical-notes",
    "view-diagnosis",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
  ],
  perawat: [
    "view-dashboard",
    "view-mcu",
    "input-mcu-result",
    "create-mcu",
    "view-visits",
    "edit-visit",
    "register-patient",
    "view-clinical-notes",
    "view-diagnosis",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
  ],
  apoteker: [
    "view-dashboard",
    "view-mcu",
    "manage-stock",
    "dispense-medicine",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
  ],
  // Analis Lab / Radiolog — proposal: hanya data penunjang (input/impor dan
  // verifikasi hasil lab). Tidak punya akses data MCU penuh → view-mcu dicabut.
  lab: [
    "view-dashboard",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
    "input-mcu-result",
    "input-lab-result",
  ],
  // Admin Klinik — proposal: registrasi, antrean, entri berobat luar klinik.
  // Tidak ada data klinis (MCU, catatan klinis, diagnosis, farmasi).
  "admin-klinik": [
    "view-dashboard",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
    "manage-employees",
    "upload-document",
    "view-visits",
    "register-patient",
    "edit-visit",
  ],
  // HR/PIC — proposal: hanya status kepatuhan + data pekerja.
  // manage-users & manage-master-data dicabut (bukan domain HR).
  hr: [
    "view-dashboard",
    "view-reports",
    "export-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
    "manage-employees",
    "upload-document",
  ],
  hse: [
    "view-dashboard",
    "view-mcu",
    "view-visits",
    "view-reports",
    "export-reports",
    "view-health-status",
    // Acknowledgement restriksi kerja (POST /mcu/restrictions/:id/acknowledge).
    // Backend juga mengizinkan HR_ADMIN & SYSTEM_ADMIN, tetapi UI sengaja
    // dipersempit ke HSE (lebih sempit dari backend = aman, bukan lebih luas).
    "acknowledge-restriction",
    "manage-hse",
    "view-emergency",
    "view-profile",
  ],
  manajemen: [
    "view-dashboard",
    "view-mcu",
    "view-visits",
    "view-reports",
    "export-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
  ],
  pekerja: [
    "view-dashboard",
    "view-mcu",
    "view-visits",
    "view-reports",
    "view-health-status",
    "view-emergency",
    "view-profile",
  ],
};

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export function canAll(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

/**
 * Permission yang bersifat *privileged action* (bukan sekadar view): role yang
 * tidak memilikinya tidak boleh melihat tombol/CTA terkait.
 */
export const PRIVILEGED_PERMISSIONS: readonly Permission[] = [
  "manage-employees",
  "upload-document",
  "create-mcu",
  "review-mcu",
  "approve-mcu",
  "input-mcu-result",
  "register-patient",
  "edit-visit",
  "manage-stock",
  "dispense-medicine",
  "issue-certificate",
  "set-health-status",
  "acknowledge-restriction",
  "manage-users",
  "manage-master-data",
  "manage-hse",
  "input-lab-result",
];

/** Semua permission yang dikenal (dipakai untuk validasi & test). */
export function allPermissions(): readonly Permission[] {
  return ALL_PERMISSIONS;
}
