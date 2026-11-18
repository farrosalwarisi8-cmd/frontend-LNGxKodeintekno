/**
 * Logika polling TTE — fungsi murni agar bisa diuji tanpa timer/browser.
 *
 * Aturan:
 *  - Poll HANYA bila ada status PENDING/PROCESSING.
 *  - Hentikan bila tab hidden/offline/polling dimatikan pengguna.
 *  - Backoff eksponensial dengan batas atas untuk menghindari request berlebih.
 *  - Satu interval aktif maksimal (dijaga hook pemanggil lewat ref).
 */

import { hasActiveSignatureStatus } from "@/features/tte/signature-status";

export const POLL_BASE_MS = 5000;
export const POLL_MAX_MS = 30000;
export const POLL_MAX_BACKOFF_STEPS = 3;

export interface PollInput {
  statuses: readonly (string | null | undefined)[];
  enabled: boolean;
  online: boolean;
  hidden: boolean;
}

export type PollDecision = "poll" | "idle";

export function decidePolling({ statuses, enabled, online, hidden }: PollInput): PollDecision {
  if (!enabled || !online || hidden) return "idle";
  return hasActiveSignatureStatus(statuses) ? "poll" : "idle";
}

/** attempt dimulai dari 0 untuk retry pertama setelah interval awal. */
export function pollDelayForAttempt(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const steps = Math.min(safeAttempt, POLL_MAX_BACKOFF_STEPS);
  return Math.min(POLL_MAX_MS, POLL_BASE_MS * 2 ** steps);
}
