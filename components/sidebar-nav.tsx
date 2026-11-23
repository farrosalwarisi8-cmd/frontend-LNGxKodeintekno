"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { ICON_MAP } from "@/shared/components/icon-map";
import { isNavActive, type NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export interface SidebarNavProps {
  items: NavigationItem[];
  pathname: string;
  /** Mode ciut: ikon saja + tooltip native (title + aria-label). */
  collapsed?: boolean;
  onNavigate?: () => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Daftar menu sidebar — presentational murni.
 *
 * Semua item berasal dari `getNavigation(role)` (`@/lib/navigation`) yang sudah
 * difilter permission; komponen ini tidak tahu role dan tidak punya aturan
 * akses sendiri. Dipisah agar bisa diuji lewat render statis per role.
 */
export function SidebarNav({
  items,
  pathname,
  collapsed = false,
  onNavigate,
  ariaLabel = "Navigasi utama",
  className,
}: SidebarNavProps) {
  return (
    <nav
      className={cn("scrollbar-subtle space-y-0.5 overflow-y-auto p-3", className)}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const Icon = ICON_MAP[item.icon] ?? Activity;
        const active = isNavActive(pathname, item.href, item.end);
        const itemClass = cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary-50 text-primary-700"
            : "text-text-secondary hover:bg-muted hover:text-foreground"
        );

        if (item.disabled) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title={collapsed ? `${item.label} — segera hadir` : "Segera hadir"}
              className={cn(itemClass, "cursor-not-allowed text-muted-foreground hover:bg-transparent")}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {!collapsed && (
                <>
                  <span className="min-w-0 truncate">{item.label}</span>
                  <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-normal text-muted-foreground">
                    Segera
                  </span>
                </>
              )}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={itemClass}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
