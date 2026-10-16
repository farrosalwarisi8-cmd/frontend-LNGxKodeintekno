"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Filter tersimpan per halaman (localStorage).
 *
 * Kebutuhan peran HR/PIC & HSE: filter yang sama dipakai berulang kali setiap
 * hari ("MCU jatuh tempo", "ada restriction"). Filter yang tidak tersimpan
 * memaksa pengguna memilih ulang setiap kali halaman dibuka.
 *
 * Aturan:
 *  - Nilai disimpan per `pageKey` (`emr-filters:<pageKey>`) supaya halaman
 *    tidak saling menimpa.
 *  - Preset dari URL (mis. `/health-status?filter=due-soon` dari dashboard)
 *    menang atas nilai tersimpan — tautan pintasan harus selalu bekerja.
 *  - Penyimpanan hanya di sisi klien (localStorage), jadi tidak ada perubahan
 *    hydration antara server dan klien.
 */

export type FilterValues = Record<string, string>;

const STORAGE_PREFIX = "emr-filters:";

/** Preset nama filter pada query string → nilai filter. */
export const FILTER_PRESETS: Record<string, FilterValues> = {
  "due-soon": { dueSoon: "1" },
  restriction: { restriction: "1" },
  mine: { mine: "1" },
};

/** Parse JSON tersimpan; mengembalikan `null` bila kosong/rusak. */
export function parseStoredFilters(raw: string | null): FilterValues | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out: FilterValues = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[key] = value;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function serializeFilters(values: FilterValues): string {
  return JSON.stringify(values);
}

/**
 * Baca preset dari query string halaman (`?filter=due-soon`, `?status=...`).
 * Mengembalikan `null` bila tidak ada parameter yang dikenal — sehingga nilai
 * tersimpan tetap dipakai.
 */
export function presetFromQuery(search: string): FilterValues | null {
  const params = new URLSearchParams(search);
  const presetName = params.get("filter");
  if (presetName && FILTER_PRESETS[presetName]) return { ...FILTER_PRESETS[presetName] };

  // Parameter eksplisit: ?status=… / ?search=… / ?restriction=1
  const explicit: FilterValues = {};
  for (const key of ["status", "search", "restriction", "dueSoon"] as const) {
    const value = params.get(key);
    if (value !== null) explicit[key] = value;
  }
  return Object.keys(explicit).length > 0 ? explicit : null;
}

export function storageKey(pageKey: string): string {
  return `${STORAGE_PREFIX}${pageKey}`;
}

export interface UseSavedFiltersResult {
  filters: FilterValues;
  /** Ubah satu filter (langsung tersimpan). */
  setFilter: (key: string, value: string) => void;
  /** Ganti beberapa filter sekaligus. */
  setFilters: (values: FilterValues) => void;
  /** Kembalikan ke nilai awal & hapus simpanan. */
  reset: () => void;
  /** true bila ada filter aktif yang berbeda dari nilai awal. */
  active: boolean;
  /** Waktu simpan terakhir (ISO) atau null. */
  savedAt: string | null;
}

export function useSavedFilters(
  pageKey: string,
  defaults: FilterValues,
  options: { queryPreset?: boolean } = {}
): UseSavedFiltersResult {
  const [filters, setFiltersState] = useState<FilterValues>(defaults);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Muat simpanan/preset setelah mount. localStorage & URL hanya tersedia di
  // klien, dan setState ditunda (setTimeout 0) agar tidak memicu render
  // bertingkat dari dalam body effect — pola yang sama dengan
  // `useSyncedModules`/`ScopeSelector` di repo ini.
  useEffect(() => {
    const timer = setTimeout(() => {
      const preset =
        options.queryPreset && typeof window !== "undefined"
          ? presetFromQuery(window.location.search)
          : null;
      if (preset) {
        // Preset dari URL (mis. pintasan "MCU jatuh tempo" di dashboard) ikut
        // DISIMPAN: setelah dibuka sekali, filter yang sama tetap terpasang
        // walau halaman dibuka ulang tanpa query.
        const merged = { ...defaults, ...preset };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(storageKey(pageKey), serializeFilters(merged));
        }
        setFiltersState(merged);
        setSavedAt(new Date().toISOString());
        return;
      }
      if (typeof window === "undefined") return;
      const stored = parseStoredFilters(window.localStorage.getItem(storageKey(pageKey)));
      if (stored) setFiltersState({ ...defaults, ...stored });
    }, 0);
    return () => clearTimeout(timer);
    // `defaults` sengaja tidak menjadi dependency: objek literal dari pemanggil
    // berubah identitas tiap render dan akan memicu loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, options.queryPreset]);

  const persist = useCallback(
    (values: FilterValues) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(pageKey), serializeFilters(values));
      }
      setSavedAt(new Date().toISOString());
    },
    [pageKey]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setFilters = useCallback(
    (values: FilterValues) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...values };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const reset = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey(pageKey));
    }
    setFiltersState(defaults);
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  const active = Object.entries(filters).some(([key, value]) => value !== (defaults[key] ?? ""));

  return { filters, setFilter, setFilters, reset, active, savedAt };
}
