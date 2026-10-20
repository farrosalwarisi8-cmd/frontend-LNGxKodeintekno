"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { can, type Permission } from "@/lib/rbac";
import { useDemoMode } from "@/lib/demo-role";
import type { Role } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

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
  // Dokumen & tanda tangan elektronik = bagian alur penerbitan sertifikat.
  // Sebelumnya menu memakai permission tetapi route tidak punya guard
  // (tautan langsung lolos) — diselaraskan agar guard = navigasi = aksi.
  { pattern: /^\/documents(?:\/.*)?$/, permission: "issue-certificate" },
  { pattern: /^\/signatures(?:\/.*)?$/, permission: "issue-certificate" },
  { pattern: /^\/reports(?:\/.*)?$/, permission: "view-reports" },
  { pattern: /^\/health-status(?:\/.*)?$/, permission: "view-health-status" },
  { pattern: /^\/users(?:\/.*)?$/, permission: "manage-users" },
  { pattern: /^\/master-data(?:\/.*)?$/, permission: "manage-master-data" },
  { pattern: /^\/audit-logs(?:\/.*)?$/, permission: "view-audit-logs" },
  // Kontrol sistem (System Administrator): konfigurasi, API key, monitoring TTE.
  { pattern: /^\/system-config(?:\/.*)?$/, permission: "manage-system-config" },
  { pattern: /^\/api-keys(?:\/.*)?$/, permission: "manage-api-keys" },
  { pattern: /^\/tte(?:\/.*)?$/, permission: "view-tte" },
  { pattern: /^\/emergency-detail(?:\/.*)?$/, permission: "monitor-emergency" },
  { pattern: /^\/waiver(?:\/.*)?$/, permission: "manage-hse" },
  // D&A forensik (modul da-test backend) hanya DOCTOR_OH / LAB_ANALYST /
  // SYSTEM_ADMIN. Sebelumnya route ini memakai `manage-hse` sehingga HSE bisa
  // membuka halaman yang API-nya selalu 403.
  { pattern: /^\/da(?:\/.*)?$/, permission: "manage-da" },
  { pattern: /^\/emergency(?:\/.*)?$/, permission: "view-emergency" },
  // Lab & Radiologi sebelumnya tidak punya guard padahal menu mensyaratkan
  // `input-lab-result` → tautan langsung melewati guard. Kini diselaraskan.
  { pattern: /^\/lab(?:\/.*)?$/, permission: "input-lab-result" },
  // A3 — Review MCU (Dokter OH). Route dengan awalan lebih spesifik dulu.
  // `/oh-review/restrictions` hanya untuk pengelola restriksi (Dokter OH);
  // role lain (HR/HSE/manajemen) memakai halaman status kepatuhan yang sudah
  // ada dan tidak diubah oleh A3.
  { pattern: /^\/oh-review\/restrictions(?:\/.*)?$/, permission: "manage-restriction" },
  { pattern: /^\/oh-review(?:\/.*)?$/, permission: "review-mcu" },
  // A3 — Modul D&A (akses terbatas: Dokter OH; HSE hanya bila ditunjuk).
  { pattern: /^\/dna(?:\/.*)?$/, permission: "view-dna" },
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
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
        <Skeleton className="w-32 h-8 mx-auto" />
      </div>
    );
  }

  // Tidak berizin: TETAP tampilkan halaman ditolak (tanpa redirect otomatis) agar
  // pengguna sempat membaca alasan dan bisa memilih kembali ke dashboard.
  if (access === "denied") {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <ShieldAlert className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Akses Ditolak</h2>
          <p className="mt-2 text-sm text-slate-500">
            Anda tidak punya izin untuk membuka halaman ini.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
