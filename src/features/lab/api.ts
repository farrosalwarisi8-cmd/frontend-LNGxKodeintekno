"use client";

/**
 * Akses data lab & radiologi — Fase A2.
 *
 * Semua request memakai `diagnosticService` (kontrak klien API yang sudah
 * ada); tidak ada endpoint baru yang dibuat di frontend. Setiap hook
 * menyediakan state loading/error/offline + coba lagi, dan sumber radiologi
 * dimuat terpisah (Promise.allSettled) supaya 403 per-role tidak
 * mengosongkan seluruh halaman.
 */

import { useCallback, useEffect, useState } from "react";
import {
  diagnosticService,
  type BackendLabOrder,
  type BackendLabOrderItem,
  type BackendLabResult,
  type BackendRadiologyOrder,
} from "@/lib/services/diagnostic.service";
import { useStore } from "@/lib/store";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True bila kegagalan terjadi karena perangkat sedang offline. */
  offline: boolean;
  reload: () => void;
}

function toMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function useOnline(): boolean {
  return useStore((s) => s.isOnline);
}

export interface LabWorkspace {
  orders: BackendLabOrder[];
  results: BackendLabResult[];
}

/**
 * Daftar order + hasil lab. Bila SALAH SATU sumber gagal total, error
 * ditampilkan; bila hanya results yang gagal, daftar order tetap tampil.
 */
export function useLabWorkspace(): AsyncState<LabWorkspace> {
  const online = useOnline();
  const scopeVersion = useStore((s) => s.scopeVersion);
  const [data, setData] = useState<LabWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    // Defer semua setState ke callback asinkron (pola repo: hindari
    // react-hooks/set-state-in-effect — lihat lib/remote-sync.ts).
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      const [orders, results] = await Promise.allSettled([
        diagnosticService.listLabOrders(),
        diagnosticService.listLabOrderResults(),
      ]);
      if (cancelled) return;
      if (orders.status === "rejected") {
        setError(toMessage(orders.reason, "Gagal memuat daftar order lab."));
        setData(null);
        setLoading(false);
        return;
      }
      setData({
        orders: orders.value,
        results: results.status === "fulfilled" ? results.value : [],
      });
      setLoading(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, scopeVersion]);

  return {
    data,
    loading,
    error: error && !online ? "Anda sedang offline. Periksa koneksi lalu coba lagi." : error,
    offline: !online,
    reload,
  };
}

/** Detail satu order lab (items + hasil per item bila dikembalikan API). */
export function useLabOrder(id: string | null): AsyncState<BackendLabOrder> {
  const online = useOnline();
  const [data, setData] = useState<BackendLabOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const order = await diagnosticService.getLabOrder(id);
        if (!cancelled) {
          setData(order);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(toMessage(e, "Gagal memuat detail order lab."));
          setData(null);
          setLoading(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, attempt]);

  return {
    data,
    loading,
    error: error && !online ? "Anda sedang offline. Periksa koneksi lalu coba lagi." : error,
    offline: !online,
    reload,
  };
}

/**
 * Hasil lab yang sudah ada per item order — dipakai untuk menampilkan
 * hasil terkunci & layar verifikasi. Diambil dari daftar hasil lalu
 * difilter di klien (kontrak GET tanpa filter query).
 */
export function resultsForOrder(
  results: BackendLabResult[],
  order: BackendLabOrder
): BackendLabResult[] {
  const itemIds = new Set((order.order_items ?? []).map((i: BackendLabOrderItem) => i.id));
  return results.filter((r) => itemIds.has(r.lab_order_item_id));
}

export interface RadiologyWorkspace {
  orders: BackendRadiologyOrder[];
  /** Error per-sumber (mis. LAB_ANALYST ditolak backend pada radiologi). */
  error: string | null;
}

/**
 * Daftar order radiologi dengan degradasi aman: kegagalan (403 scope)
 * TIDAK menggagalkan halaman lab — hanya mengosongkan kolom radiologi
 * dengan pesannya sendiri.
 */
export function useRadiologyOrders(): AsyncState<RadiologyWorkspace> {
  const online = useOnline();
  const scopeVersion = useStore((s) => s.scopeVersion);
  const [data, setData] = useState<RadiologyWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const orders = await diagnosticService.listRadiologyOrders();
        if (!cancelled) {
          setData({ orders, error: null });
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setData({ orders: [], error: toMessage(e, "Gagal memuat order radiologi.") });
          setLoading(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, scopeVersion]);

  return {
    data,
    loading,
    error: error && !online ? "Anda sedang offline. Periksa koneksi lalu coba lagi." : error,
    offline: !online,
    reload,
  };
}
