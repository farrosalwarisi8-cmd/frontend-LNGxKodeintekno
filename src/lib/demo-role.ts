"use client";

import { useDemoRole } from "@/features/people/hooks/use-demo-role";
import type { DemoRole } from "@/features/people/api/people.types";
import { useCurrentUser } from "@/lib/store";
import type { Role } from "@/lib/types";
import { DEMO_ROLE_LABELS, DEMO_ROLE_TO_ROLE } from "@/lib/demo-role-map";

export { DEMO_ROLE_LABELS, DEMO_ROLE_TO_ROLE };

export interface DemoModeState {
  /** Demo mode aktif? Jika tidak, role session yang berlaku. */
  enabled: boolean;
  /** Role demo yang dipilih (hanya dipakai saat `enabled`). */
  demoRole: DemoRole;
  /** Role efektif untuk seluruh keputusan permission frontend. */
  role: Role | null;
  setDemoRole: (role: DemoRole) => void;
  setEnabled: (enabled: boolean) => void;
}

export function useDemoMode(): DemoModeState {
  const enabled = useDemoRole((s) => s.enabled);
  const demoRole = useDemoRole((s) => s.role);
  const setDemoRole = useDemoRole((s) => s.setRole);
  const setEnabled = useDemoRole((s) => s.setEnabled);
  const user = useCurrentUser();

  const role: Role | null = enabled ? DEMO_ROLE_TO_ROLE[demoRole] : (user?.role ?? null);

  return { enabled, demoRole, role, setDemoRole, setEnabled };
}
