"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DemoRole } from "../api/people.types";

/**
 * Mode demo (simulasi UI).
 *
 * - `enabled=false` (default): role session yang berlaku — perilaku produksi.
 * - `enabled=true`: role demo menggerakkan menu, bottom navigation, route
 *   guard, dan action button lewat mapping tunggal di `src/lib/demo-role.ts`.
 *
 * Memilih role lewat `setRole()` otomatis mengaktifkan demo mode.
 */
interface DemoRoleState {
  role: DemoRole;
  enabled: boolean;
  setRole: (role: DemoRole) => void;
  setEnabled: (enabled: boolean) => void;
}

export const useDemoRole = create<DemoRoleState>()(
  persist(
    (set) => ({
      role: "ADMIN_CLINIC",
      enabled: false,
      setRole: (role) => set({ role, enabled: true }),
      setEnabled: (enabled) => set({ enabled }),
    }),
    { name: "emr-demo-role" }
  )
);
