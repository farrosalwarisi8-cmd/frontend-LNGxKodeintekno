"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Focus management antar-route.
 *
 * Tanpa ini, navigasi client-side (Link/router.push) membiarkan fokus tertinggal
 * di elemen pemicu — sering kali link sidebar yang sudah tidak relevan — sehingga
 * pengguna keyboard/screen reader harus Tab ulang dari awal untuk mencapai konten
 * baru. Setelah route berubah, fokus dipindahkan ke `<h1>` halaman tujuan (bila
 * ada) atau ke `<main id="main-content">`.
 *
 * Catatan perilaku:
 * - Render pertama dilewati: fokus awal saat halaman dibuka bukan urusan komponen
 *   ini (skip link & urutan Tab alami tetap berlaku).
 * - `preventScroll` menjaga posisi scroll; browser tetap menggulir bila perlu.
 * - `<h1>` diberi `tabIndex=-1` agar dapat menerima fokus terprogram tanpa masuk
 *   urutan Tab.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const main = document.getElementById("main-content");
    if (!main) return;

    let cancelled = false;
    // Satu frame setelah commit: konten route tujuan sudah ter-render.
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const heading = main.querySelector<HTMLElement>("h1");
      if (heading) {
        if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        return;
      }
      main.focus({ preventScroll: true });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
