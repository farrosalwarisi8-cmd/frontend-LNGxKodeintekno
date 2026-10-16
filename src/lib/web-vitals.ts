/**
 * Pengukuran Web Vitals sisi klien (LCP, INP, CLS) untuk frontend EMR.
 *
 * Tidak mengandalkan backend: hasil ditulis ke sessionStorage dan diekspor ke
 * `window.__klinkVitals`, sehingga tim QA/stakeholder dapat membaca hasil
 * ukuran nyata pada perangkat (HP menengah, jaringan 3G lemah) lewat
 * DevTools console:
 *
 *   window.__klinkVitals.getLast()
 *
 * Target "Baik" menurut Core Web Vitals (disetujui sementara, akan
 * disetujui bersama stakeholder — lihat PERFORMA_TARGET.md):
 *   LCP ≤ 2500 ms, INP ≤ 200 ms, CLS ≤ 0.10
 */

export const VITAL_TARGETS = {
  LCP: 2500, // ms
  INP: 200,  // ms
  CLS: 0.10, // unitless
} as const;

const VITAL_POOR = {
  LCP: 4000, // ms
  INP: 500,  // ms
  CLS: 0.25, // unitless
} as const;

export type VitalName = "LCP" | "INP" | "CLS";

export interface VitalsMetric {
  name: VitalName;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
  url: string;
}

export interface VitalsSnapshot {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  at: number;
  url: string;
  targets: typeof VITAL_TARGETS;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput?: boolean;
}

interface EventTimingEntry extends PerformanceEntry {
  processingTime?: number;
}

export function rateMetric(
  name: VitalName,
  value: number
): "good" | "needs-improvement" | "poor" {
  const good = VITAL_TARGETS[name];
  const poor = VITAL_POOR[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/**
 * Penyimpan hasil ukuran ke sessionStorage (data hilang saat tab ditutup —
 * cukup untuk inspeksi per sesi pengujian) dan window untuk akses DevTools.
 */
const STORAGE_KEY = "kodein-klinik-vitals-last";
const HISTORY_KEY = "kodein-klinik-vitals-history";
const HISTORY_LIMIT = 10;

function currentUrl(): string {
  return typeof location !== "undefined" ? location.href : "";
}

export function persistVitals(snap: VitalsSnapshot): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    let history: VitalsSnapshot[] = [];
    try {
      history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
    } catch {
      history = [];
    }
    if (!Array.isArray(history)) history = [];
    history = [snap, ...history].slice(0, HISTORY_LIMIT);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage mungkin diblokir/penuh — abaikan.
  }
}

export function exposeVitals(snap: VitalsSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    let history: VitalsSnapshot[] = [];
    if (typeof sessionStorage !== "undefined") {
      try {
        history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
      } catch {
        history = [];
      }
    }
    (window as unknown as { __klinkVitals?: unknown }).__klinkVitals = {
      getLast: () => snap,
      getHistory: () => history,
      targets: VITAL_TARGETS,
      rateMetric,
    };
  } catch {
    // Abaikan.
  }
}

export function reportVitals(snap: VitalsSnapshot): void {
  persistVitals(snap);
  exposeVitals(snap);
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.info("[web-vitals]", snap);
  }
}

export class WebVitalsMonitor {
  private lcp = -1;
  private cls = 0;
  private inp = -1;
  private observers: PerformanceObserver[] = [];

  observe(): void {
    if (
      typeof window === "undefined" ||
      typeof PerformanceObserver === "undefined"
    ) {
      return;
    }

    // LCP: ambil kandidat terakhir (perkiraan mendekati nilai final).
    const oLcp = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) this.lcp = last.startTime;
    });
    oLcp.observe({ entryTypes: ["largest-contentful-paint"], buffered: true });
    this.observers.push(oLcp);

    // CLS: jumlahkan layout-shift yang tidak disebabkan input pengguna.
    const oCls = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as LayoutShiftEntry;
        if (!shift.hadRecentInput) this.cls += shift.value;
      }
    });
    oCls.observe({ entryTypes: ["layout-shift"], buffered: true });
    this.observers.push(oCls);

    // INP: max processingTime dari setiap interaksi (Event Timing API).
    const oInp = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const ev = entry as EventTimingEntry;
        const pt = ev.processingTime ?? 0;
        if (pt > this.inp) this.inp = pt;
      }
    });
    oInp.observe({ entryTypes: ["event"], buffered: true });
    this.observers.push(oInp);
  }

  snapshot(): VitalsSnapshot {
    return {
      lcp: this.lcp >= 0 ? this.lcp : null,
      inp: this.inp >= 0 ? this.inp : null,
      cls: Math.round((this.cls + Number.EPSILON) * 10000) / 10000,
      at: Date.now(),
      url: currentUrl(),
      targets: VITAL_TARGETS,
    };
  }

  disconnect(): void {
    for (const o of this.observers) {
      try {
        o.disconnect();
      } catch {
        // Abaikan.
      }
    }
    this.observers = [];
  }
}

export const webVitals = new WebVitalsMonitor();
