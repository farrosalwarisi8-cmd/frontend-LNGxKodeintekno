"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  UserRound,
  MoreHorizontal,
  WifiOff,
  ShieldCheck,
  Users,
  Settings,
  Globe,
  AlertTriangle,
  X,
  ChevronRight,
  FlaskConical,
  FileText,
  Pill,
  LogOut,
  User,
  Menu,
  LayoutDashboard,
  ClipboardList,
  BadgeCheck,
  BarChart3,
  Database,
  History,
  HeartPulse,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { useDemoMode } from "@/lib/demo-role";
import type { DemoRole } from "@/features/people/api/people.types";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getBottomNavigation, getNavigation, getOverflowNavigation, isNavActive } from "@/lib/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { NotificationBell } from "@/components/notification-bell";
import { toastError, toastSuccess } from "@/lib/use-toast";

const ROLE_LABELS: Record<DemoRole, string> = {
  ADMIN_CLINIC: "Admin Klinik",
  HR_PIC: "HR/PIC",
  SYSTEM_ADMIN: "System Administrator",
  PUBLIC_WORKER: "Worker/Public",
};

const ROLE_ICONS: Record<DemoRole, typeof ShieldCheck> = {
  ADMIN_CLINIC: ShieldCheck,
  HR_PIC: Users,
  SYSTEM_ADMIN: Settings,
  PUBLIC_WORKER: Globe,
};

const ROLE_COLORS: Record<DemoRole, string> = {
  ADMIN_CLINIC: "bg-primary-100 text-primary-700",
  HR_PIC: "bg-info-100 text-info-600",
  SYSTEM_ADMIN: "bg-purple-100 text-purple-600",
  PUBLIC_WORKER: "bg-slate-100 text-slate-600",
};

const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  activity: Activity,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  pill: Pill,
  "badge-check": BadgeCheck,
  "bar-chart": BarChart3,
  "shield-check": ShieldCheck,
  database: Database,
  history: History,
  "heart-pulse": HeartPulse,
  stethoscope: Stethoscope,
  "user-plus": UserRound,
  "list-ordered": ClipboardList,
  user: User,
  flask: FlaskConical,
  "alert-triangle": AlertTriangle,
  settings: Settings,
  globe: Globe,
};

// Navigasi terpusat di `@/lib/navigation` (label, icon, permission, active route).

export function EmrShell({ children }: { children: React.ReactNode }) {
  const { enabled: demoEnabled, demoRole, role } = useDemoMode();
  const pathname = usePathname();
  const router = useRouter();
  const isOnline = useStore((s) => s.isOnline);
  const setOnline = useStore((s) => s.setOnline);
  const offlineQueueLength = useStore((s) => s.offlineQueue.length);
  const replayOfflineQueue = useStore((s) => s.replayOfflineQueue);
  const [demoBannerVisible, setDemoBannerVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const user = useCurrentUser();
  const logout = useStore((s) => s.logout);

  const prevOnline = useRef(isOnline);

  // Sinkronisasi status online/offline ke store (sumber kebenaran tunggal)
  // agar indikator, antrean aksi, dan replay saat kembali online bisa
  // diakses oleh seluruh komponen lewat store.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [setOnline]);

  // Saat kembali online dari keadaan offline: proses ulang antrean aksi
  // lokal dan beri tahu pengguna melalui toast.
  useEffect(() => {
    const wasOffline = !prevOnline.current && isOnline;
    prevOnline.current = isOnline;
    if (!wasOffline) return;
    void replayOfflineQueue().then(({ ok, failed }) => {
      if (ok > 0) {
        toastSuccess("Tersambung kembali", `${ok} aksi disinkronkan.`);
      }
      if (failed > 0) {
        toastError("Sinkronisasi gagal sebagian", `${failed} aksi masih menunggu.`);
      }
    });
  }, [isOnline, replayOfflineQueue]);

  // Badge profil mengikuti role efektif: demo role saat demo mode aktif,
  // selain itu role session.
  const RoleIcon = demoEnabled ? ROLE_ICONS[demoRole] : ShieldCheck;
  const roleLabel = demoEnabled
    ? ROLE_LABELS[demoRole]
    : user?.title || (role ? ROLES[role]?.label : "") || "—";
  const badgeClass = demoEnabled ? ROLE_COLORS[demoRole] : "bg-slate-100 text-slate-600";

  // Satu sumber navigasi: difilter per permission role efektif
  // (lihat @/lib/navigation). Sidebar dan bottom navigation memakai filter yang sama.
  const nav = getNavigation(role);
  const bottomNav = getBottomNavigation(role);
  const hasMoreNav = getOverflowNavigation(role).length > 0;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {demoEnabled && demoBannerVisible && (
        <div className="relative z-50 border-b border-warning-200 bg-warning-50 px-4 py-2">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-warning-700">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium">Demo mode</span>
              <span className="hidden sm:inline">— data dan permission disimulasikan di frontend.</span>
            </div>
            <button
              onClick={() => setDemoBannerVisible(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-warning-600 hover:bg-warning-100"
              aria-label="Tutup banner demo"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex" aria-label="Navigasi utama">
          <div className="flex h-14 items-center gap-2.5 border-b border-slate-100 px-5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary-600">
              <Activity className="size-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Kodein Klinik</p>
              <p className="text-[10px] text-slate-500">EMR Modul 01</p>
            </div>
          </div>

          <div className="border-b border-slate-100 px-4 py-3">
            <div className={cn("flex items-center gap-2 rounded-xl p-2.5", badgeClass)}>
              <RoleIcon className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{roleLabel}</p>
                <p className="text-[10px] opacity-70">{demoEnabled ? "Demo role aktif" : "Peran sesi"}</p>
              </div>
              <Link
                href="/demo"
                className="ml-auto -my-1 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:bg-black/5 hover:opacity-100"
                aria-label="Ubah demo role"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <nav className="scrollbar-subtle flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Navigasi utama">
            {nav.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? Activity;
              const active = isNavActive(pathname, item.href, item.end);
              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300"
                    title="Segera hadir"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{item.label}</span>
                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-normal text-slate-400">
                      Segera
                    </span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] text-slate-400">Kodein Klinik · EMR Demo</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary-600">
                <Activity className="size-3.5 text-white" aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">Kodein Klinik</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="size-5" />
              </button>
            </div>
          </header>

          {/* Breadcrumb compact di mobile */}
          <div className="border-b border-slate-100 bg-white px-4 py-2 lg:hidden">
            <Breadcrumb />
          </div>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
              <div className="scrollbar-subtle fixed right-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                    <X className="size-5" />
                  </button>
                </div>
                <nav className="space-y-1" aria-label="Navigasi mobile">
                  {nav.map((item) => {
                    const Icon = ICON_MAP[item.icon] ?? Activity;
                    const active = isNavActive(pathname, item.href, item.end);
                    if (item.disabled) {
                      return (
                        <span
                          key={item.href}
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300"
                        >
                          <Icon className="size-4" />
                          {item.label}
                          <span className="ml-auto text-[10px] text-slate-400">Segera hadir</span>
                        </span>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Topbar desktop: breadcrumb + offline + notifikasi + user menu */}
          <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:flex">
            <Breadcrumb />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                    {(user?.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block text-xs font-semibold leading-tight text-slate-900">{user?.name}</span>
                    <span className="block text-[10px] leading-tight text-slate-500">{user?.title}</span>
                  </span>
                  <ChevronRight className="size-3.5 rotate-90 text-slate-400" aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <Link
                        href="/my/profile"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <User className="size-4" aria-hidden="true" /> Profil Saya
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <LogOut className="size-4" aria-hidden="true" /> Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          {/* Indikator offline (persisten di semua breakpoint) */}
          {!isOnline && (
            <div className="border-b border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700" role="status">
              <div className="flex items-center gap-2">
                <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                <span>Offline — aksi disimpan secara lokal</span>
                {offlineQueueLength > 0 && (
                  <span className="ml-auto shrink-0 flex items-center gap-1 rounded bg-warning-200 px-2 py-0.5 text-[10px] font-medium">
                    {offlineQueueLength} antrean
                  </span>
                )}
                <span className="text-warning-500">Akan disinkronkan saat tersambung kembali</span>
              </div>
            </div>
          )}

          <main className="scrollbar-subtle flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-6 lg:pb-6">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigasi bawah"
      >
        {bottomNav.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? Activity;
          const active = isNavActive(pathname, item.href, item.end);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary-600" : "text-slate-400 hover:text-slate-700"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("size-5", active ? "text-primary-600" : "text-slate-400")} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {hasMoreNav && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-slate-400 hover:text-slate-700"
            aria-label="Menu lainnya"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            <span>Lainnya</span>
          </button>
        )}
      </nav>
    </div>
  );
}
