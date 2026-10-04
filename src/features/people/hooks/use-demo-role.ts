"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DemoRole } from "../api/people.types";

interface DemoRoleState {
  role: DemoRole;
  setRole: (role: DemoRole) => void;
}

export const useDemoRole = create<DemoRoleState>()(
  persist(
    (set) => ({
      role: "ADMIN_CLINIC",
      setRole: (role) => set({ role }),
    }),
    { name: "emr-demo-role" }
  )
);
