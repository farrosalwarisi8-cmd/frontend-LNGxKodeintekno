"use client";

import { useCallback, useEffect } from "react";
import { webVitals, reportVitals } from "@/lib/web-vitals";

/**
 * Pelapor Web Vitals (LCP, INP, CLS) yang dipasang di root layout.
 *
 * Pengamat aktif setelah mount dan hasil dikirim (reportVitals) saat halaman
 * disembunyikan/ditutup, sehingga seluruh sesi interaksi (termasuk INP)
 * tertangkap. Hasil bisa dibaca di DevTools console via
 * `window.__klinkVitals.getLast()`.
 */
export function VitalsReporter(): React.ReactNode {
  const flush = useCallback(() => {
    webVitals.disconnect();
    reportVitals(webVitals.snapshot());
  }, []);

  useEffect(() => {
    webVitals.observe();

    const onPageHide = () => flush();
    const onBeforeUnload = () => flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      webVitals.disconnect();
    };
  }, [flush]);

  return null;
}
