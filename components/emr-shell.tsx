"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  User,
  Users,
  WifiOff,
  X,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { useDemoMode, DEMO_ROLE_LABELS } from "@/lib/demo-role";
import type { DemoRole } from "@/features/people/api/people.types";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getBottomNavigation, getNavigation, getOverflowNavigation, isNavActive } from "@/lib/navigation";
import { dataScopeForRole, DATA_SCOPE_LABELS } from "@/lib/data-scope";
import { Breadcrumb } from "@/components/breadcrumb";
import { EnvironmentBanner } from "@/components/environment-banner";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteTitle } from "@/components/route-title";
import { RouteFocus } from "@/components/route-focus";
import { useIdleTimeout } from "@/features/auth/use-idle-timeout";
import { ScopeSelector } from "@/components/scope-selector";
import { SidebarNav } from "@/components/sidebar-nav";
import { ICON_MAP } from "@/shared/components/icon-map";
import { toastError, toastSuccess } from "@/lib/use-toast";

const ROLE_ICONS: Record<DemoRole, typeof ShieldCheck> = {
  ADMIN_CLINIC: ShieldCheck,
  HR_PIC: Users,
  SYSTEM_ADMIN: Settings,
  PUBLIC_WORKER: Globe,
};

export function EmrShell({ children }: { children: React.ReactNode }) {
  const { enabled: demoEnabled, demoRole, role } = useDemoMode();
  const pathname = usePathname();
  const router = useRouter();
  const isOnline = useStore((s) => s.isOnline);
  const setOnline = useStore((s) => s.setOnline);
  const offlineQueueLength = useStore((s) => s.offlineQueue.length);
  const replayOfflineQueue = useStore((s) => s.replayOfflineQueue);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const user = useCurrentUser();
  const logout = useStore((s) => s.logout);

  const prevOnline = useRef(isOnline);

  // Sinkronisasi status online/offline ke store (sumber kebenaran tunggal).
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

  // Saat kembali online dari keadaan offline: proses ulang antrean aksi lokal.
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

  // Identitas di header mengikuti ROLE EFEKTIF (demo role saat demo aktif),
  // bukan selamanya akun sesi — supaya banner, menu, dan header tidak
  // saling bertentangan saat berganti role demo.
  const RoleIcon = demoEnabled ? ROLE_ICONS[demoRole] : ShieldCheck;
  const roleLabel = demoEnabled
    ? DEMO_ROLE_LABELS[demoRole]
    : user?.title || (role ? ROLES[role]?.label : "") || "—";
  const displayName = demoEnabled ? DEMO_ROLE_LABELS[demoRole] : (user?.name ?? "—");
  const displayTitle = demoEnabled ? "Demo role aktif" : (user?.title ?? "");
  const scope = dataScopeForRole(role);
  const scopeLabel = scope ? DATA_SCOPE_LABELS[scope] : null;

  const nav = getNavigation(role);
  const bottomNav = getBottomNavigation(role);
  const hasMoreNav = getOverflowNavigation(role).length > 0;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // PRD 19.1 — timeout sesi simulasi. Hanya berjalan saat ada sesi nyata;
  // demo role (tanpa sesi) tidak boleh di-logout di tengah presentasi.
  useIdleTimeout({
    enabled: Boolean(user),
    onTimeout: () => {
      logout();
      router.push("/login?reason=timeout");
    },
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Lewati ke konten utama
      </a>
      <RouteTitle />
      <RouteFocus />
      {/* Banner berada di alur normal DI ATAS header dan tidak sticky, sehingga
          tidak pernah menimpa header; area konten mengisi sisa viewport. */}
      <div className="shrink-0">
        <EnvironmentBanner />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "hidden h-full shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 lg:flex",
            collapsed ? "w-[76px]" : "w-64"
          )}
          aria-label="Navigasi utama"
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center gap-2.5 border-b border-border",
              collapsed ? "justify-center px-2" : "px-5"
            )}
          >
            <Logo size="md" />
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Kodein Klinik</p>
                <p className="text-[10px] text-muted-foreground">EMR Okupasi</p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-b border-border px-3 py-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl bg-muted p-2.5 text-text-secondary",
                collapsed && "justify-center p-2"
              )}
            >
              <RoleIcon className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && (
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">{roleLabel}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {demoEnabled ? "Demo role aktif" : "Peran sesi"}
                    {scopeLabel ? ` · ${scopeLabel}` : ""}
                  </p>
                </div>
              )}
              {!collapsed && (
                <Link
                  href="/demo"
                  className="ml-auto -my-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:bg-foreground/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Ubah demo role"
                  title="Ubah demo role"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>

          <SidebarNav
            items={nav}
            pathname={pathname}
            collapsed={collapsed}
            className="min-h-0 flex-1"
          />

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-3 py-2">
            {!collapsed && (
              <p className="truncate text-[10px] text-muted-foreground">Kodein Klinik · EMR Okupasi</p>
            )}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={collapsed ? "Perbesar sidebar" : "Ciutkan sidebar"}
              title={collapsed ? "Perbesar sidebar" : "Ciutkan sidebar"}
              aria-pressed={!collapsed}
            >
              {collapsed ? (
                <ChevronsRight className="size-4" aria-hidden="true" />
              ) : (
                <ChevronsLeft className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight text-foreground">
                  Kodein Klinik
                </span>
                <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                  {roleLabel}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex size-11 items-center justify-center rounded-lg text-text-secondary hover:bg-muted"
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu className="size-5" />
              </button>
            </div>
          </header>

          {/* Breadcrumb compact di mobile */}
          <div className="shrink-0 border-b border-border bg-card px-4 py-2 lg:hidden">
            <Breadcrumb />
          </div>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="fixed inset-0 bg-foreground/40" onClick={() => setMobileMenuOpen(false)} />
              <div className="scrollbar-subtle fixed right-0 top-0 flex h-full w-72 flex-col overflow-y-auto bg-card p-4 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-foreground">Menu</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    aria-label="Tutup menu"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="mb-3">
                  <ScopeSelector />
                </div>
                <SidebarNav
                  items={nav}
                  pathname={pathname}
                  onNavigate={() => setMobileMenuOpen(false)}
                  ariaLabel="Navigasi mobile"
                  className="p-0"
                />
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Tema tampilan</p>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}

          {/* Topbar desktop: breadcrumb + role efektif + offline + notifikasi + user menu */}
          <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 lg:flex">
            <Breadcrumb />
            <div className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-text-secondary xl:inline">
                {roleLabel}
              </span>
              <ThemeToggle />
              {!isOnline && (
                <div
                  role="status"
                  className="flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-xs text-warning-700"
                >
                  <WifiOff className="size-3.5" aria-hidden="true" />
                  <span>Offline</span>
                </div>
              )}
              <ScopeSelector />
              <NotificationBell />
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold uppercase text-primary-700">
                    {displayName.charAt(0)}
                  </span>
                  <span className="hidden text-left xl:block">
                    <span className="block max-w-40 truncate text-xs font-semibold leading-tight text-foreground">
                      {displayName}
                    </span>
                    <span className="block max-w-40 truncate text-[10px] leading-tight text-muted-foreground">
                      {displayTitle}
                    </span>
                  </span>
                  <ChevronRight className="size-3.5 rotate-90 text-muted-foreground" aria-hidden="true" />
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-card p-1 shadow-lg">
                      <Link
                        href="/my/profile"
                        role="menuitem"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted"
                      >
                        <User className="size-4" aria-hidden="true" /> Profil Saya
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-muted"
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
            <div className="shrink-0 border-b border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700" role="status">
              <div className="flex items-center gap-2">
                <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                <span>Offline — aksi disimpan secara lokal</span>
                {offlineQueueLength > 0 && (
                  <span className="ml-auto flex shrink-0 items-center gap-1 rounded bg-warning-200 px-2 py-0.5 text-[10px] font-medium">
                    {offlineQueueLength} antrean
                  </span>
                )}
                <span className="text-warning-600">Akan disinkronkan saat tersambung kembali</span>
              </div>
            </div>
          )}

          <main
            id="main-content"
            tabIndex={-1}
            className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-24 focus:outline-none md:px-6 lg:pb-8"
          >
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary-600" : "text-muted-foreground hover:text-text-secondary"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("size-5", active ? "text-primary-600" : "text-muted-foreground")} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {hasMoreNav && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground hover:text-text-secondary"
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
