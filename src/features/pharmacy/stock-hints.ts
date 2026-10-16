import type { BackendInventoryItem } from "../../lib/services/pharmacy.service";

/**
 * Peringatan stok & FEFO untuk layar dispensing.
 *
 * Apoteker harus melihat dua hal SEBELUM menekan "Proses Dispensing":
 *  1. apakah stok site ini cukup untuk jumlah yang diminta (kalau tidak,
 *     backend pasti menolak dan transaksi gagal di tengah jalan),
 *  2. batch mana yang akan dipakai FEFO dan kapan kadaluarsanya (obat yang
 *     hampir kadaluarsa harus keluar lebih dulu — dan itu perlu terlihat).
 *
 * Semua perhitungan di sini murni (tanpa React/backend) supaya bisa diuji.
 */

/** Batch yang kadaluarsa dalam rentang ini ditandai "segera kadaluarsa". */
export const FEFO_WARN_DAYS = 90;

const MS_PER_DAY = 24 * 3600 * 1000;

export interface StockHint {
  /** id item resep (kunci tampilan). */
  itemId: string;
  name: string;
  requested: number;
  /** Stok site untuk obat ini; `null` bila obat tidak ada di snapshot inventaris. */
  currentStock: number | null;
  isLowStock: boolean;
  nearestExpiryDate: string | null;
  /** Batch terdekat kadaluarsa dalam FEFO_WARN_DAYS hari. */
  expiresSoon: boolean;
  /** Kekurangan stok (0 bila cukup atau stok tidak diketahui). */
  shortfall: number;
}

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function isWithinDays(dateIso: string | null | undefined, today: string, days: number): boolean {
  if (!dateIso) return false;
  const due = new Date(dateIso).getTime();
  const now = new Date(today).getTime();
  if (Number.isNaN(due) || Number.isNaN(now)) return false;
  return due <= now + days * MS_PER_DAY;
}

export interface StockHintInput {
  itemId: string;
  name?: string;
  quantity?: number;
}

export function buildStockHints(
  items: readonly StockHintInput[],
  inventory: readonly BackendInventoryItem[],
  options: { today: string; warnDays?: number }
): StockHint[] {
  const { today, warnDays = FEFO_WARN_DAYS } = options;
  const byName = new Map(inventory.map((i) => [normalize(i.genericName), i]));

  return items.map((item) => {
    const product = byName.get(normalize(item.name));
    const requested = item.quantity ?? 0;
    const currentStock = product ? product.currentStock : null;
    const shortfall =
      currentStock !== null && requested > currentStock ? requested - currentStock : 0;

    return {
      itemId: item.itemId,
      name: item.name ?? "",
      requested,
      currentStock,
      isLowStock: Boolean(product?.isLowStock),
      nearestExpiryDate: product?.nearestExpiryDate ?? null,
      expiresSoon: isWithinDays(product?.nearestExpiryDate, today, warnDays),
      shortfall,
    };
  });
}

export interface DispenseWarnings {
  /** Ada obat yang stoknya tidak cukup → jangan kirim transaksi. */
  blocked: boolean;
  shortItems: StockHint[];
  expiringSoon: StockHint[];
  lowStock: StockHint[];
  /** Ringkasan satu kalimat untuk banner. */
  summary: string;
}

export function summarizeDispenseWarnings(hints: readonly StockHint[]): DispenseWarnings {
  const shortItems = hints.filter((h) => h.shortfall > 0);
  const expiringSoon = hints.filter((h) => h.expiresSoon);
  const lowStock = hints.filter((h) => h.isLowStock && h.shortfall === 0);

  const parts: string[] = [];
  if (shortItems.length > 0) {
    parts.push(`${shortItems.length} obat stoknya tidak cukup`);
  }
  if (expiringSoon.length > 0) {
    parts.push(`${expiringSoon.length} obat memakai batch yang segera kadaluarsa (FEFO)`);
  }
  if (lowStock.length > 0) {
    parts.push(`${lowStock.length} obat berada di bawah stok minimum`);
  }

  return {
    blocked: shortItems.length > 0,
    shortItems,
    expiringSoon,
    lowStock,
    summary: parts.length > 0 ? parts.join(" · ") : "Stok cukup untuk semua item resep.",
  };
}
