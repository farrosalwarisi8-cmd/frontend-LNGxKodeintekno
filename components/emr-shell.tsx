"use client";

import { useEffect, useState } from "react";
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
  Bell,
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
import { useDemoRole } from "@/features/people/hooks/use-demo-role";
import type { DemoRole } from "@/features/people/api/people.types";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { cn } from "@/lib/utils";

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

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/demo", label: "Demo", icon: "flask" },
  { href: "/people", label: "People", icon: "users" },
  { href: "/employees", label: "Pekerja", icon: "users" },
  { href: "/mcu", label: "MCU", icon: "activity" },
  { href: "/mcu/review", label: "Review MCU", icon: "stethoscope" },
  { href: "/visits", label: "Kunjungan", icon: "clipboard-list" },
  { href: "/visits/queue", label: "Antrean", icon: "list-ordered" },
  { href: "/medical-records", label: "Rekam Medis", icon: "file-text" },
  { href: "/medicine", label: "Farmasi", icon: "pill" },
  { href: "/medicine/dispense", label: "Dispensing", icon: "pill" },
  { href: "/certificates", label: "Sertifikat", icon: "badge-check" },
  { href: "/reports", label: "Laporan", icon: "bar-chart" },
  { href: "/health-status", label: "Status Kesehatan", icon: "heart-pulse" },
  { href: "/waiver", label: "Waiver", icon: "shield-check" },
  { href: "/da", label: "D&A", icon: "flask" },
  { href: "/emergency", label: "Emergency", icon: "alert-triangle" },
  { href: "/users", label: "User", icon: "users" },
  { href: "/master-data", label: "Master Data", icon: "database" },
  { href: "/audit-logs", label: "Audit Log", icon: "history" },
];

function useOnline() {
  // Nilai awal dibaca saat inisialisasi state (bukan di dalam effect)
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function EmrShell({ children }: { children: React.ReactNode }) {
  const { role } = useDemoRole();
  const pathname = usePathname();
  const router = useRouter();
  const isOnline = useOnline();
  const [demoBannerVisible, setDemoBannerVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const RoleIcon = ROLE_ICONS[role];
  const user = useCurrentUser();
  const logout = useStore((s) => s.logout);
  const notifications = useStore((s) => s.notifications);

  const unreadCount = user ? notifications.filter((n) => n.userId === user.id && !n.read).length : 0;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {demoBannerVisible && (
        <div className="relative z-50 border-b border-warning-200 bg-warning-50 px-4 py-2">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-warning-700">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="font-medium">Demo mode</span>
              <span className="hidden sm:inline">— data dan permission disimulasikan di frontend.</span>
            </div>
            <button
              onClick={() => setDemoBannerVisible(false)}
              className="shrink-0 rounded p-0.5 text-warning-600 hover:bg-warning-100"
              aria-label="Tutup banner demo"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex" aria-label="Navigasi utama">
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
            <div className={cn("flex items-center gap-2 rounded-xl p-2.5", ROLE_COLORS[role])}>
              <RoleIcon className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">{ROLE_LABELS[role]}</p>
                <p className="text-[10px] opacity-70">Demo role aktif</p>
              </div>
              <Link href="/demo" className="ml-auto shrink-0 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Ubah demo role">
                <ChevronRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = ICON_MAP[item.icon] ?? Activity;
              const active = pathname === item.href || (item.href !== "/demo" && pathname.startsWith(item.href));
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

          {!isOnline && (
            <div className="border-t border-slate-100 p-4">
              <div className="flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2.5 text-xs text-warning-700">
                <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                <span>Offline — data belum dikirim</span>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-[10px] text-slate-400">Frontend-only demo · No backend</p>
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
              {!isOnline && (
                <div className="flex items-center gap-1 rounded-full bg-warning-50 px-2 py-1 text-xs text-warning-600">
                  <WifiOff className="size-3" aria-hidden="true" />
                  <span className="hidden sm:inline">Offline</span>
                </div>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Menu"
              >
                <Menu className="size-5" />
              </button>
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="fixed inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
              <div className="fixed right-0 top-0 h-full w-72 overflow-y-auto bg-white p-4 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                    <X className="size-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = ICON_MAP[item.icon] ?? Activity;
                    const active = pathname === item.href || (item.href !== "/demo" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                          active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100"
                        )}
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

          <main className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-6 lg:pb-6">
            <div className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-200 bg-white lg:hidden"
        aria-label="Navigasi bawah"
      >
        {[
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/mcu", label: "MCU", icon: Activity },
          { href: "/visits", label: "Kunjungan", icon: ClipboardList },
          { href: "/medicine", label: "Farmasi", icon: Pill },
        ].map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-slate-400 hover:text-slate-700"
          aria-label="Menu lainnya"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          <span>Lainnya</span>
        </button>
      </nav>
    </div>
  );
}
