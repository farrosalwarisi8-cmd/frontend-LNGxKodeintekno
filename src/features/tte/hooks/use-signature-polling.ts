"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decidePolling, pollDelayForAttempt } from "@/features/tte/polling";

export interface SignaturePolling {
  /** Auto-refresh aktif (bisa dimatikan pengguna). */
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  /** Sedang ada satu request refresh (auto/manual). */
  refreshing: boolean;
  /** Status jaringan browser. */
  online: boolean;
  /** Ada status PENDING/PROCESSING dan auto-refresh sedang berjalan. */
  isPolling: boolean;
  /** Waktu refresh terakhir yang berhasil. */
  lastUpdated: Date | null;
  /** Satu klik = maksimal satu request (single-flight). */
  refreshNow: () => Promise<void>;
}

/**
 * Polling aman untuk status TTE.
 *
 * - Hanya berjalan untuk PENDING/PROCESSING (lihat `decidePolling`).
 * - Berhenti saat tab hidden, offline, status terminal, atau auto-refresh OFF.
 * - Backoff eksponensial; satu timeout aktif; cleanup saat unmount/route change.
 * - `inFlightRef` mencegah request ganda akibat double-click / filter change.
 */
export function useSignaturePolling(
  statuses: readonly (string | null | undefined)[],
  refresh: () => Promise<void>
): SignaturePolling {
  const [enabled, setEnabled] = useState(true);
  const [hidden, setHidden] = useState(() =>
    typeof document === "undefined" ? false : document.visibilityState === "hidden"
  );
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pollTick, setPollTick] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const attemptRef = useRef(0);

  const run = useCallback(
    async (manual: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setRefreshing(true);
      try {
        await refresh();
        setLastUpdated(new Date());
        if (manual) attemptRef.current = 0;
        else attemptRef.current += 1;
        // Memicu penjadwalan ulang dengan delay backoff berikutnya.
        setPollTick((t) => t + 1);
      } catch {
        // Biarkan state terakhir tampil; attempt berikutnya mencoba lagi.
      } finally {
        inFlightRef.current = false;
        setRefreshing(false);
      }
    },
    [refresh]
  );

  const refreshNow = useCallback(async () => {
    await run(true);
  }, [run]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const statusesKey = statuses.map((s) => s ?? "").join("|");
  const decision = decidePolling({ statuses, enabled, online, hidden });

  useEffect(() => {
    if (decision === "idle" || timerRef.current) return;
    const delay = pollDelayForAttempt(attemptRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void run(false);
    }, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [decision, statusesKey, pollTick, run]);

  // Cleanup eksplisit saat unmount (route change).
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    []
  );

  return {
    enabled,
    setEnabled,
    refreshing,
    online,
    isPolling: decision === "poll",
    lastUpdated,
    refreshNow,
  };
}
