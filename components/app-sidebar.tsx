"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  ClipboardList,
  FileText,
  Pill,
  BadgeCheck,
  BarChart3,
  ShieldCheck,
  Database,
  History,
  Stethoscope,
  HeartPulse,
  UserPlus,
  ListOrdered,
  User,
  Microscope,
  HardHat,
  Crown,
} from "lucide-react";
import { useCurrentUser } from "@/lib/store";
import { NAV } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  "user-plus": UserPlus,
  "list-ordered": ListOrdered,
  user: User,
  microscope: Microscope,
  "hard-hat": HardHat,
  crown: Crown,
};

export function AppSidebar() {
  const user = useCurrentUser();
  const pathname = usePathname();
  if (!user) return null;
  const nav = NAV[user.role] ?? [];

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-4" />
        </div>
        <span className="text-sm font-semibold">Kodein Klinik</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {nav.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
