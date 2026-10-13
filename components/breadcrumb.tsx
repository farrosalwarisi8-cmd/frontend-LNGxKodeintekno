"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { buildBreadcrumbs } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb dari pathname (terpusat di src/lib/navigation.ts).
 *
 * - Desktop: seluruh rantai, halaman aktif bukan link.
 * - Mobile: hanya 2 item terakhir (parent + aktif) agar ringkas.
 */
export function Breadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  const items = buildBreadcrumbs(pathname);

  if (items.length === 0) return null;

  const mobileItems = items.length > 2 ? items.slice(-2) : items;
  const renderList = (list: typeof items, mobile: boolean) => (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 items-center gap-1.5 text-sm", className)}
    >
      {list.map((item, i) => {
        const isLast = i === list.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />}
            {isLast || !item.href ? (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn(
                  "truncate py-1",
                  isLast ? "font-medium text-slate-900" : "text-slate-500"
                )}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate py-1 text-slate-500 transition-colors hover:text-slate-900"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
      {mobile && null}
    </nav>
  );

  return (
    <>
      <div className="hidden md:block">{renderList(items, false)}</div>
      <div className="md:hidden">{renderList(mobileItems, true)}</div>
    </>
  );
}
