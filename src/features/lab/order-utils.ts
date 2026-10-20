/**
 * Util murni daftar order lab/radiologi — Fase A2.
 *
 * Filter/pencarian/pagination dilakukan di klien karena kontrak GET
 * /diagnostic/lab-orders tidak menyediakan parameter query (lihat
 * LAPORAN_A2_LAB_RADIOLOGI.md — Inventaris kontrak).
 *
 * ATURAN: tidak ada ambang klinis atau daftar tes yang ditulis tangan di
 * sini. Rentang referensi dan penandaan abnormal HANYA ditampilkan dari
 * nilai API — tidak ada perhitungan "tinggi/rendah" di klien.
 */

import type { BackendLabOrder, BackendLabResultValue } from "@/lib/services/diagnostic.service";

export interface LabOrderFilters {
  /** Pencarian bebas (id order, nama tes, kode tes). */
  search: string;
  /** Kunci status dari API ("" = semua). */
  status: string;
  /** Kode/jenis tes dari API ("" = semua). */
  testType: string;
  /** Rentang tanggal ordered_at (ISO date, "" = tanpa batas). */
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: LabOrderFilters = {
  search: "",
  status: "",
  testType: "",
  dateFrom: "",
  dateTo: "",
};

export type SortDirection = "newest" | "oldest";

/** Opsi jenis tes untuk filter — diturunkan dari data API, bukan hardcode. */
export function testTypeOptions(
  orders: BackendLabOrder[]
): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      const t = item.test_type;
      if (t?.id && !map.has(t.id)) map.set(t.id, t.name || t.code || t.id);
    }
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "id"));
}

function itemMatchesSearch(order: BackendLabOrder, needle: string): boolean {
  if ((order.id ?? "").toLowerCase().includes(needle)) return true;
  return (order.order_items ?? []).some((item) => {
    const t = item.test_type;
    if (!t) return false;
    return (
      t.name?.toLowerCase().includes(needle) ||
      t.code?.toLowerCase().includes(needle) ||
      false
    );
  });
}

function withinDate(iso: string | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function filterLabOrders(
  orders: BackendLabOrder[],
  filters: LabOrderFilters
): BackendLabOrder[] {
  const needle = filters.search.trim().toLowerCase();
  return orders.filter((order) => {
    if (needle && !itemMatchesSearch(order, needle)) return false;
    if (filters.status && (order.status ?? "").toUpperCase() !== filters.status) return false;
    if (filters.testType) {
      const has = (order.order_items ?? []).some((i) => i.lab_test_type_id === filters.testType);
      if (!has) return false;
    }
    return withinDate(order.ordered_at, filters.dateFrom, filters.dateTo);
  });
}

export function sortLabOrders(
  orders: BackendLabOrder[],
  direction: SortDirection
): BackendLabOrder[] {
  const sorted = [...orders].sort((a, b) =>
    (a.ordered_at ?? "").localeCompare(b.ordered_at ?? "")
  );
  return direction === "newest" ? sorted.reverse() : sorted;
}

export interface Page<T> {
  items: T[];
  totalPages: number;
  total: number;
}

export const DEFAULT_PAGE_SIZE = 10;

export function paginate<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): Page<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), totalPages, total };
}

/**
 * Format `reference_range` (Json di backend: `{"male":{"min":13,"max":17}}`,
 * `{"min":x,"max":y}`, string, atau angka) menjadi teks tampilan.
 *
 * HANYA membaca nilai yang sudah ada — tidak pernah menghasilkan ambang baru.
 * Bentuk yang tidak dikenal ditampilkan ringkas sebagai JSON pendek (datanya
 * tetap dari API, bukan angka karangan).
 */
export function formatReferenceRange(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const s = value.trim();
    return s || null;
  }
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatReferenceRange(v)).filter(Boolean);
    return parts.length ? parts.join(" / ") : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.min === "number" || typeof obj.max === "number") {
      const min = typeof obj.min === "number" ? obj.min : null;
      const max = typeof obj.max === "number" ? obj.max : null;
      if (min !== null && max !== null) return `${min} – ${max}`;
      if (min !== null) return `≥ ${min}`;
      if (max !== null) return `≤ ${max}`;
    }
    const nested: string[] = [];
    for (const [key, child] of Object.entries(obj)) {
      const text = formatReferenceRange(child);
      if (text) nested.push(`${key}: ${text}`);
    }
    if (nested.length) return nested.join("; ");
    try {
      const json = JSON.stringify(value);
      return json.length <= 120 ? json : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Info penandaan abnormal dari `abnormal_flag` API (boolean).
 *
 * Kontrak backend HANYA punya boolean (tinggi/rendah tidak dibedakan), jadi
 * label yang jujur adalah "Di luar rentang". Bila API kelak menambah arah,
 * tambahkan pemetaan di sini dari data — bukan dari ambang karangan.
 */
export function abnormalInfo(flag: boolean | null | undefined): {
  label: string;
  tone: "danger" | "muted";
} {
  return flag ? { label: "Di luar rentang", tone: "danger" } : { label: "", tone: "muted" };
}

/** Teks nilai hasil (numerik atau teks) untuk tampilan. */
export function resultValueText(value: BackendLabResultValue): string {
  if (value.numeric_value !== null && value.numeric_value !== undefined) {
    return String(value.numeric_value);
  }
  if (value.text_value !== null && value.text_value !== undefined) return value.text_value;
  return "—";
}
