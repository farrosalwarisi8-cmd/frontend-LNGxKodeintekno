import type { Role } from "@/lib/types";

/**
 * Data scope per peran (lapisan UI).
 *
 * Nilai ini hanya menentukan apakah pemilih site perlu ditampilkan. Cakupan
 * data sebenarnya tetap ditegakkan backend berdasarkan token:
 * - GLOBAL   : lintas site/organisasi (System Administrator, Manajemen)
 * - ORG      : satu organisasi, bisa beberapa site (HR/PIC, HSE)
 * - SITE     : satu site kerja (peran klinik & penunjang)
 * - PERSONAL : hanya data milik sendiri (Pekerja)
 */
export type DataScope = "GLOBAL" | "ORG" | "SITE" | "PERSONAL";

export const DATA_SCOPE_BY_ROLE: Record<Role, DataScope> = {
  admin: "GLOBAL",
  manajemen: "GLOBAL",
  hr: "ORG",
  hse: "ORG",
  "admin-klinik": "SITE",
  perawat: "SITE",
  "dokter-oh": "SITE",
  "dokter-klinik": "SITE",
  apoteker: "SITE",
  lab: "SITE",
  pekerja: "PERSONAL",
};

export const DATA_SCOPE_LABELS: Record<DataScope, string> = {
  GLOBAL: "Global (semua site)",
  ORG: "Organisasi",
  SITE: "Site kerja",
  PERSONAL: "Data pribadi",
};

export function dataScopeForRole(role: Role | null | undefined): DataScope | null {
  return role ? (DATA_SCOPE_BY_ROLE[role] ?? "SITE") : null;
}

/**
 * Hanya scope GLOBAL/ORG yang mencakup lebih dari satu site. Peran SITE dan
 * PERSONAL tidak boleh melihat pemilih site (tidak ada site lain untuk dipilih).
 */
export function canSwitchSiteScope(role: Role | null | undefined): boolean {
  const scope = dataScopeForRole(role);
  return scope === "GLOBAL" || scope === "ORG";
}
