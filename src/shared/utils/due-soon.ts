/**
 * Jendela "jatuh tempo" untuk MCU / masa berlaku Fitness to Work.
 *
 * Dipakai dua tempat dengan definisi yang HARUS sama:
 *  - kartu dashboard per peran ("MCU jatuh tempo ≤ 30 hari")
 *  - filter tersimpan HR/HSE di halaman /health-status (`?filter=due-soon`)
 */

/** Ambang "MCU jatuh tempo" (hari). */
export const MCU_DUE_SOON_DAYS = 30;

const MS_PER_DAY = 24 * 3600 * 1000;

/**
 * `true` bila `dateIso` sudah lewat atau jatuh dalam `days` hari ke depan.
 * Tanggal yang sudah lewat dihitung jatuh tempo (paling mendesak).
 */
export function isDueSoon(dateIso: string | undefined | null, today: string, days: number): boolean {
  if (!dateIso) return false;
  const due = new Date(dateIso).getTime();
  const now = new Date(today).getTime();
  if (Number.isNaN(due) || Number.isNaN(now)) return false;
  return due <= now + days * MS_PER_DAY;
}

/** `true` bila tanggal sudah lewat (kedaluwarsa). */
export function isPast(dateIso: string | undefined | null, today: string): boolean {
  if (!dateIso) return false;
  const due = new Date(dateIso).getTime();
  const now = new Date(today).getTime();
  if (Number.isNaN(due) || Number.isNaN(now)) return false;
  return due < now;
}

/** Tanggal hari ini sebagai ISO `yyyy-mm-dd` (zona waktu lokal perangkat). */
export function todayIso(now: Date = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
