"use client";

import { useEffect, useRef } from "react";

/**
 * PRD 19.1 — session timeout simulasi.
 *
 * Logout otomatis setelah tidak ada aktivitas pengguna. Timer HANYA berjalan
 * saat tab terlihat: bila pengguna meninggalkan tab, waktu tunggu baru dimulai
 * ketika tab kembali aktif, sehingga demo tidak ter-logout di latar belakang.
 *
 * Debounce aktivitas 1 detik: event pointer/scroll yang sangat rapat tidak
 * menjadwalkan ulang timer berkali-kali.
 */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface IdleTimerOptions {
  onTimeout: () => void;
  timeoutMs?: number;
  win?: Window;
  doc?: Document;
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Implementasi timer murni (tanpa React) agar dapat diuji dengan fake timers.
 * Mengembalikan fungsi cleanup.
 */
export function startIdleTimer({
  onTimeout,
  timeoutMs = IDLE_TIMEOUT_MS,
  win = window,
  doc = document,
}: IdleTimerOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastActivity = Date.now();

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // Tab tersembunyi tidak boleh memicu logout di tengah presentasi;
      // timer dijadwalkan ulang saat tab kembali terlihat.
      if (doc.visibilityState !== "visible") {
        schedule();
        return;
      }
      onTimeout();
    }, timeoutMs);
  };

  const markActivity = () => {
    const now = Date.now();
    if (now - lastActivity < 1000) return;
    lastActivity = now;
    schedule();
  };

  const onVisibility = () => {
    if (doc.visibilityState === "visible") {
      lastActivity = Date.now();
      schedule();
    }
  };

  ACTIVITY_EVENTS.forEach((event) =>
    win.addEventListener(event, markActivity, { passive: true })
  );
  doc.addEventListener("visibilitychange", onVisibility);
  schedule();

  return () => {
    if (timer) clearTimeout(timer);
    ACTIVITY_EVENTS.forEach((event) => win.removeEventListener(event, markActivity));
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}

export interface UseIdleTimeoutOptions {
  onTimeout: () => void;
  /** Default 30 menit. */
  timeoutMs?: number;
  enabled?: boolean;
}

export function useIdleTimeout({
  onTimeout,
  timeoutMs = IDLE_TIMEOUT_MS,
  enabled = true,
}: UseIdleTimeoutOptions): void {
  const onTimeoutRef = useRef(onTimeout);

  // Sinkronkan callback di effect, bukan saat render (React refs purity).
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    return startIdleTimer({
      onTimeout: () => onTimeoutRef.current(),
      timeoutMs,
    });
  }, [enabled, timeoutMs]);
}
