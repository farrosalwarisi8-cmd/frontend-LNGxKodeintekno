"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { can, type Permission } from "@/lib/rbac";
import { useDemoMode } from "@/lib/demo-role";
import type { Role } from "@/lib/types";
import { PageLoading } from "./loading-spinner";
import { AccessDenied } from "./access-denied";

export interface RoutePermissionRule {
  pattern: RegExp;
  permission: Permission;
}

export const ROUTE_PERMISSIONS: readonly RoutePermissionRule[] = [
  { pattern: /^\/dashboard$/, permission: "view-dashboard" },
  { pattern: /^\/employees/, permission: "manage-employees" },
  { pattern: /^\/people/, permission: "manage-employees" },
  { pattern: /^\/mcu\/review(?:\/.*)?$/, permission: "review-mcu" },
  { pattern: /^\/mcu\/new(?:\/.*)?$/, permission: "create-mcu" },
  { pattern: /^\/mcu(?:\/.*)?$/, permission: "view-mcu" },
  { pattern: /^\/visits\/new(?:\/.*)?$/, permission: "register-patient" },
  { pattern: /^\/visits(?:\/.*)?$/, permission: "view-visits" },
  { pattern: /^\/medical-records(?:\/.*)?$/, permission: "view-clinical-notes" },
  { pattern: /^\/medicine\/dispense(?:\/.*)?$/, permission: "dispense-medicine" },
  // Retur obat adalah aksi dispensing (sama dengan item navigasi "Retur Obat"),
  // bukan manajemen stok — diselaraskan agar guard = navigasi.
  { pattern: /^\/medicine\/return(?:\/.*)?$/, permission: "dispense-medicine" },
  { pattern: /^\/medicine(?:\/.*)?$/, permission: "manage-stock" },
  { pattern: /^\/certificates(?:\/.*)?$/, permission: "issue-certificate" },
  { pattern: /^\/reports(?:\/.*)?$/, permission: "view-reports" },
  { pattern: /^\/health-status(?:\/.*)?$/, permission: "view-health-status" },
  { pattern: /^\/users(?:\/.*)?$/, permission: "manage-users" },
  { pattern: /^\/master-data(?:\/.*)?$/, permission: "manage-master-data" },
  { pattern: /^\/audit-logs(?:\/.*)?$/, permission: "view-audit-logs" },
  { pattern: /^\/waiver(?:\/.*)?$/, permission: "manage-hse" },
  { pattern: /^\/da(?:\/.*)?$/, permission: "manage-hse" },
  { pattern: /^\/emergency(?:\/.*)?$/, permission: "view-emergency" },
  // Lab & Radiologi sebelumnya tidak punya guard padahal menu mensyaratkan
  // `input-lab-result` → tautan langsung melewati guard. Kini diselaraskan.
  { pattern: /^\/lab(?:\/.*)?$/, permission: "input-lab-result" },
  { pattern: /^\/my(?:\/.*)?$/, permission: "view-profile" },
];

export function matchRoutePermission(pathname: string): Permission | null {
  const withoutQuery = pathname.split("?")[0];
  const normalized = withoutQuery.replace(/\/+$/, "") || "/";
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.pattern.test(normalized)) {
      return rule.permission;
    }
  }
  return null;
}

function isInternalPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  return true;
}

export type RouteAccess = "loading" | "login" | "denied" | "allow";

export interface RouteAccessInput {
  hydrated: boolean;
  authenticated: boolean;
  /** Role efektif (session role, atau demo role saat demo mode aktif). */
  role: Role | null;
  pathname: string;
}

/**
 * Keputusan akses route — fungsi murni agar perilaku guard bisa diuji.
 *
 * - `loading` : sesi belum selesai direhidrasi (jangan putuskan apa pun).
 * - `login`   : belum login pada route terproteksi → arahkan ke /login.
 * - `denied`  : sudah login tetapi tidak punya permission → TETAP di halaman
 *               AccessDenied (tanpa redirect otomatis) dan konten terlindungi
 *               tidak pernah dirender.
 * - `allow`   : tampilkan halaman.
 */
export function resolveRouteAccess({
  hydrated,
  authenticated,
  role,
  pathname,
}: RouteAccessInput): RouteAccess {
  if (!hydrated) return "loading";

  const required = matchRoutePermission(pathname);
  if (!required) return authenticated ? "allow" : "loading";
  if (!authenticated) return "login";
  if (role && can(role, required)) return "allow";
  return "denied";
}

/** URL login beserta `from` hanya jika path internal (anti open-redirect). */
export function loginRedirectUrl(pathname: string): string {
  const from = isInternalPath(pathname) ? pathname : "/dashboard";
  return `/login?from=${encodeURIComponent(from)}`;
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  // Sesi dibaca dari localStorage: jangan putuskan redirect sebelum rehidrasi
  // selesai, supaya refresh / buka URL langsung tidak dianggap belum login.
  const hasHydrated = useStore((s) => s._hasHydrated);
  const router = useRouter();
  const pathname = usePathname();
  // Role efektif: session role, atau demo role saat demo mode aktif.
  const { role } = useDemoMode();

  const access = resolveRouteAccess({
    hydrated: hasHydrated,
    authenticated: Boolean(user),
    role,
    pathname,
  });

  useEffect(() => {
    if (access === "login") {
      router.replace(loginRedirectUrl(pathname));
    }
  }, [access, pathname, router]);

  if (access === "loading" || access === "login") {
    return <PageLoading />;
  }

  // Tidak berizin: TETAP tampilkan AccessDenied (tanpa redirect otomatis) agar
  // pengguna sempat membaca alasan dan bisa memilih kembali ke dashboard.
  if (access === "denied") {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
