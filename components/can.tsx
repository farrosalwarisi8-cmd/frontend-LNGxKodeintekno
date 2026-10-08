"use client";

import { useCallback } from "react";
import { canPerform, type ActionId } from "@/lib/actions";
import { useDemoMode } from "@/lib/demo-role";

/**
 * Hook permission untuk komponen client.
 *
 * `const can = useCan(); if (can("people.create")) { ... }`
 *
 * Permission dihitung dari **role efektif** (session role, atau demo role ketika
 * demo mode aktif) sehingga tombol selalu konsisten dengan menu & route guard.
 */
export function useCan() {
  const { role } = useDemoMode();
  return useCallback((action: ActionId) => canPerform(role, action), [role]);
}

/**
 * Wrapper deklaratif:
 *
 * `<Can action="mcu.approve"><Button>Approve</Button></Can>`
 *
 * `fallback` opsional untuk menampilkan alternatif (mis. disabled + helper text).
 */
export function Can({
  action,
  fallback = null,
  children,
}: {
  action: ActionId;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const can = useCan();
  return <>{can(action) ? children : fallback}</>;
}
