import type { DemoRole } from "@/features/people/api/people.types";
import type { Role } from "@/lib/types";

/**
 * Jembatan demo role → role session (tanpa dependensi React agar bisa diuji).
 *
 * `DemoRole` hanya kosakata mode demo (simulasi UI). Saat demo mode aktif,
 * role demo dipetakan ke `Role` session yang sama sehingga menu, bottom
 * navigation, route guard, tombol/action, dan badge profil memakai satu
 * sumber permission (`lib/rbac.ts`).
 *
 * Ini BUKAN authorization produksi — otorisasi sebenarnya tetap di backend.
 */
export const DEMO_ROLE_TO_ROLE: Record<DemoRole, Role> = {
  ADMIN_CLINIC: "admin-klinik",
  HR_PIC: "hr",
  SYSTEM_ADMIN: "admin",
  PUBLIC_WORKER: "pekerja",
};

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  ADMIN_CLINIC: "Admin Klinik",
  HR_PIC: "HR/PIC",
  SYSTEM_ADMIN: "System Administrator",
  PUBLIC_WORKER: "Worker/Public",
};

export const DEMO_ROLES: readonly DemoRole[] = [
  "ADMIN_CLINIC",
  "HR_PIC",
  "SYSTEM_ADMIN",
  "PUBLIC_WORKER",
];
