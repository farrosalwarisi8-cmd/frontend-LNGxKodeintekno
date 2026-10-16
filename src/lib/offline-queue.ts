import { uid } from "@/lib/format";

/**
 * Antrean aksi lokal untuk mode offline.
 *
 * Aksi yang dilakukan saat perangkat offline dicatat di sini dan disimpan
 * ke localStorage, lalu diproses ulang (replay) saat perangkat kembali
 * tersambung. Backend tidak diubah — antrean ini hanya di sisi frontend.
 */

export const OFFLINE_QUEUE_STORAGE_KEY = "kodein-klinik-offline-queue";

export type OfflineAction =
  | "addEmployee"
  | "updateEmployee"
  | "registerVisit"
  | "updateVisit"
  | "dispense"
  | "submitMCU";

/**
 * Aksi yang sudah diterapkan ke store lokal secara optimistik, sehingga saat
 * replay hanya perlu dikonfirmasi sebagai "tercatat" tanpa dieksekusi ulang
 * (menghindari duplikasi / potong stok ganda).
 */
const OFFLINE_ACK_ONLY: Record<OfflineAction, boolean> = {
  addEmployee: true,
  updateEmployee: false,
  registerVisit: true,
  updateVisit: false,
  dispense: true,
  submitMCU: true,
};

export const MAX_OFFLINE_RETRIES = 3;

export interface OfflineQueueEntry {
  id: string;
  action: OfflineAction;
  args: unknown[];
  attemptedAt: string;
  retries: number;
  error?: string;
}

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function loadOfflineQueue(): OfflineQueueEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as OfflineQueueEntry[];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(entries: OfflineQueueEntry[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota/blokir penyimpanan — abaikan.
  }
}

export function enqueueOfflineQueue(
  entries: OfflineQueueEntry[],
  entry: Omit<OfflineQueueEntry, "id" | "attemptedAt" | "retries"> & {
    retries?: number;
  }
): OfflineQueueEntry[] {
  const next: OfflineQueueEntry = {
    id: uid("oq"),
    attemptedAt: new Date().toISOString(),
    retries: 0,
    ...entry,
  };
  return [...entries, next];
}

export function removeOfflineQueue(
  entries: OfflineQueueEntry[],
  id: string
): OfflineQueueEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function clearOfflineQueue(): OfflineQueueEntry[] {
  return [];
}

export function isAckOnly(action: OfflineAction): boolean {
  return OFFLINE_ACK_ONLY[action] ?? false;
}
