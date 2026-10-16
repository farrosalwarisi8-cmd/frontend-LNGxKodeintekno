"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { buildBreadcrumbs } from "@/lib/navigation";

const APP_NAME = "Kodein Klinik";

/** Judul halaman dari route aktif (label terakhir breadcrumb). */
export function routeDocumentTitle(pathname: string): string {
  const items = buildBreadcrumbs(pathname);
  const label = items[items.length - 1]?.label;
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}

/**
 * Menjaga `<title>` tab browser konsisten dengan halaman aktif.
 *
 * Halaman internal adalah client component sehingga tidak bisa mengekspor
 * `metadata` Next. Komponen ini menyetel `document.title` dari registry label
 * yang SAMA dengan breadcrumb (`@/lib/navigation`) — jadi judul tab, breadcrumb,
 * dan sidebar tidak pernah menyimpang.
 *
 * Next menyisipkan kembali `<title>` dari metadata root SETELAH commit (dan saat
 * navigasi), sehingga nilai kita bisa tertimpa. `MutationObserver` hanya
 * mengembalikannya selama route tidak berubah; penulisan nilai yang sama tidak
 * memicu perubahan lagi sehingga tidak terjadi loop.
 */
export function RouteTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const desired = routeDocumentTitle(pathname);
    const enforce = () => {
      if (document.title !== desired) document.title = desired;
    };

    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
