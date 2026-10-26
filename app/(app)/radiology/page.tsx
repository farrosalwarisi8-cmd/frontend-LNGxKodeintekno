"use client";

/**
 * Halaman Radiologi — Fase A2 (Tugas 7 & 8).
 *
 * Route & menu terpisah dari alur analis lab, dilindungi tiga lapis:
 *  - menu: item "Radiologi" (permission `write-radiology-report`, di balik
 *    flag `NEXT_PUBLIC_FEATURE_LAB`);
 *  - route: RouteGuard `/radiology` → `write-radiology-report`;
 *  - aksi: tombol kirim laporan hanya setelah order dipilih & role berizin.
 *
 * Pemisahan analis vs radiolog di sisi klien HANYA bisa memakai data role
 * backend yang diberikan sesi; bila tidak tersedia, keduanya berbagi role
 * `lab` dan pemisahan sejarnya tetap milik backend (lihat BLOCKER BACKEND
 * di LAPORAN_A2_LAB_RADIOLOGI.md). UI tidak memalsukan pemisahan.
 *
 * Saat flag MATI: route menampilkan status nonaktif (menu pun tidak tampil),
 * sehingga perilaku aplikasi identik dengan main.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Card } from "@/shared/components/design-system/card";
import { Button } from "@/shared/components/design-system/button";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import { isLabRadiologyEnabled } from "@/lib/feature-flags";
import { diagnosticService, type BackendRadiologyOrder } from "@/lib/services/diagnostic.service";
import { formatDateTime } from "@/lib/format";
import { useRadiologyOrders } from "@/features/lab/api";
import { LabStatusBadge } from "@/features/lab/components/lab-status-badge";
import { radiologyOrderStatusInfo } from "@/features/lab/status-map";
import {
  RadiologyReportForm,
  type RadiologyOrderDetail,
} from "@/features/radiology/report-form";

async function fetchDetail(id: string): Promise<RadiologyOrderDetail> {
  const order = await diagnosticService.getRadiologyOrder(id);
  return order as RadiologyOrderDetail;
}

function RadiologyWorkspace() {
  const state = useRadiologyOrders();
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<RadiologyOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const orders = state.data?.orders ?? [];
  const sourceError = state.data?.error ?? null;

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        const d = await fetchDetail(selectedId);
        if (!cancelled) {
          setDetail(d);
          setDetailLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : "Gagal memuat order radiologi.");
          setDetail(null);
          setDetailLoading(false);
        }
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedId, reloadKey]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Radiologi</h1>
        <p className="text-sm text-muted-foreground">
          Daftar order radiologi dan penyusunan laporan radiolog — terpisah dari alur analis lab
        </p>
      </div>

      {state.error && (
        <ErrorState
          title={state.offline ? "Anda sedang offline" : "Gagal memuat order radiologi"}
          message={state.error}
          onRetry={state.reload}
        />
      )}

      {state.loading && !state.error && (
        <div className="space-y-2" aria-busy="true" aria-label="Memuat order radiologi">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          <Card className="space-y-4 p-4">
            <NativeSelect
              label="Pilih order radiologi"
              value={selectedId}
              onChange={(v) => setSelectedId(v)}
              placeholder="— Pilih order —"
              options={orders.map((o: BackendRadiologyOrder) => ({
                value: o.id,
                label: `${o.modality} · ${o.body_part} · ${formatDateTime(o.ordered_at)} · ${radiologyOrderStatusInfo(o.status).label}`,
              }))}
            />

            {orders.length > 0 && (
              <ul className="divide-y divide-border">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-medium text-foreground">{o.id}</span>
                      <span className="ml-2 text-text-secondary">
                        {o.modality} · {o.body_part} · {formatDateTime(o.ordered_at)}
                      </span>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Kunjungan {o.encounter_id ?? "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <LabStatusBadge info={radiologyOrderStatusInfo(o.status)} />
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedId === o.id ? "default" : "outline"}
                        onClick={() => setSelectedId(o.id)}
                        aria-pressed={selectedId === o.id}
                      >
                        {selectedId === o.id ? "Dipilih" : "Buka laporan"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* 403 per-role (mis. LAB_ANALYST pada endpoint radiologi) tampil
                terpisah & tidak mengosongkan halaman. */}
            {sourceError && (
              <div
                className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700"
                role="status"
              >
                Data radiologi tidak tersedia untuk akun Anda pada scope ini: {sourceError}
              </div>
            )}

            {orders.length === 0 && !sourceError && (
              <EmptyState
                icon={ScanLine}
                title="Belum ada order radiologi"
                description="Order radiologi dibuat dari klinik/MCU pada scope Anda."
              />
            )}
          </Card>

          {detailLoading && <Skeleton className="h-64 w-full" />}
          {detailError && (
            <ErrorState
              title="Gagal memuat detail order"
              message={detailError}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}
          {detail && detail.id === selectedId && !detailLoading && (
            <RadiologyReportForm
              key={detail.id}
              order={detail}
              onSubmitted={() => setReloadKey((k) => k + 1)}
            />
          )}
        </>
      )}
    </div>
  );
}

function FeatureInactive() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Radiologi</h1>
      <Card className="space-y-3 p-6 text-sm text-text-secondary">
        <p className="flex items-center gap-2 font-medium text-foreground">
          Fitur Radiologi belum aktif pada environment ini.
        </p>
        <p>
          Aktifkan feature flag <code>NEXT_PUBLIC_FEATURE_LAB</code> pada build environment untuk
          membuka menu dan halaman Radiologi. Selama flag mati, menu tidak tampil dan perilaku
          aplikasi tidak berubah.
        </p>
        <Link href="/dashboard">
          <Button type="button" variant="outline">
            <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke dashboard
          </Button>
        </Link>
      </Card>
    </div>
  );
}

export default function RadiologyPage() {
  if (!isLabRadiologyEnabled()) {
    return <FeatureInactive />;
  }
  return <RadiologyWorkspace />;
}
