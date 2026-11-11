"use client";

/**
 * Emergency Mode — pemantau status sinkronisasi darurat:
 *   GET /api/v1/sync/conflicts?deviceId=     (konflik yang menunggu resolusi)
 *   GET /api/v1/metrics/queue                (SYSTEM_ADMIN, HSE_MANAGER)
 *   GET /api/v1/metrics/alerts               (SYSTEM_ADMIN, HSE_MANAGER)
 *
 * Halaman `/emergency` adalah antarmuka operasi darurat (input antrian
 * offline); halaman ini memantau kesehatan jalur sinkronisasi dari sisi
 * backend, termasuk konflik dan antrean worker.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { formatDate } from "@/lib/format";
import { syncService, type SyncConflict } from "@/lib/services/sync.service";
import { systemService } from "@/lib/services/system.service";
import {
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Server,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

export default function EmergencyDetailPage() {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(true);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [queue, setQueue] = useState<Record<string, unknown> | null>(null);
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [obsError, setObsError] = useState<string | null>(null);
  const [loadingObs, setLoadingObs] = useState(true);

  const loadConflicts = useCallback(async () => {
    setLoadingConflicts(true);
    setConflictError(null);
    try {
      const rows = await syncService.listConflicts();
      setConflicts(rows);
    } catch (e) {
      setConflictError(
        e instanceof Error ? e.message : "Gagal memuat konflik sinkronisasi."
      );
    } finally {
      setLoadingConflicts(false);
    }
  }, []);

  const loadObservability = useCallback(async () => {
    setLoadingObs(true);
    setObsError(null);
    const [queueRes, alertsRes] = await Promise.allSettled([
      systemService.getQueueStatus(),
      systemService.getAlerts(),
    ]);
    if (queueRes.status === "fulfilled") setQueue(queueRes.value);
    if (alertsRes.status === "fulfilled") setAlerts(alertsRes.value ?? []);
    if (queueRes.status === "rejected" && alertsRes.status === "rejected") {
      setObsError("Status antrean dan alert hanya untuk System Admin / HSE Manager.");
    }
    setLoadingObs(false);
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => {
      void loadConflicts();
      void loadObservability();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadConflicts, loadObservability]);

  const openConflicts = conflicts.filter(
    (c) => (c.status ?? "CONFLICT").toUpperCase() === "CONFLICT"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/emergency">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-4" />
              Mode Darurat
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Pemantau Mode Darurat
            </h1>
            <p className="text-sm text-muted-foreground">
              Kesehatan jalur sinkronisasi offline: konflik, antrean worker, dan alert
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void loadConflicts();
            void loadObservability();
          }}
          disabled={loadingConflicts || loadingObs}
        >
          <RefreshCw
            className={`size-4 ${loadingConflicts || loadingObs ? "animate-spin" : ""}`}
          />
          Muat Ulang
        </Button>
      </div>

      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${
                openConflicts.length > 0
                  ? "bg-warning-100 text-warning-600"
                  : "bg-success-100 text-success-600"
              }`}
            >
              {openConflicts.length > 0 ? (
                <AlertTriangle className="size-5" />
              ) : (
                <CheckCircle className="size-5" />
              )}
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {openConflicts.length}
              </p>
              <p className="text-xs text-muted-foreground">Konflik Terbuka</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-600">
              <Server className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {queue ? "Aktif" : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Antrean Worker</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${
                alerts.length > 0
                  ? "bg-danger-100 text-danger-600"
                  : "bg-success-100 text-success-600"
              }`}
            >
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{alerts.length}</p>
              <p className="text-xs text-muted-foreground">Alert Operasional</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Konflik sinkronisasi */}
      <h2 className="text-sm font-semibold text-foreground">Konflik Sinkronisasi</h2>
      {loadingConflicts && <Skeleton className="h-20 w-full" />}
      {!loadingConflicts && conflictError && (
        <ErrorState
          title="Gagal memuat konflik"
          message={conflictError}
          onRetry={loadConflicts}
        />
      )}
      {!loadingConflicts && !conflictError && openConflicts.length === 0 && (
        <EmptyState
          title="Tidak ada konflik"
          description="Semua record darurat sudah selaras dengan server."
          icon={CheckCircle}
        />
      )}
      {!loadingConflicts && !conflictError && openConflicts.length > 0 && (
        <div className="space-y-2">
          {openConflicts.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">Konflik</Badge>
                    <span className="text-sm font-medium text-foreground">
                      {c.offline_queue?.entity_type ?? "Entitas tidak dikenal"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Record lokal {c.offline_queue?.local_record_id ?? c.id} · tercatat{" "}
                    {formatDate(c.synced_at ?? "")}
                  </p>
                </div>
                <Can action="mcu.review">
                  <Link href="/offline-sync">
                    <Button variant="outline" size="sm">
                      Selesaikan
                    </Button>
                  </Link>
                </Can>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Status antrean & alert */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Status Antrean Worker</h3>
          </div>
          {loadingObs && <Skeleton className="mt-3 h-24 w-full" />}
          {!loadingObs && !queue && (
            <p className="mt-3 text-sm text-muted-foreground">
              {obsError ?? "Status antrean tidak tersedia."}
            </p>
          )}
          {!loadingObs && queue && (
            <dl className="mt-3 space-y-1 text-xs">
              {Object.entries(queue).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="font-mono text-muted-foreground">{key}</dt>
                  <dd className="font-medium text-foreground">
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Alert Operasional ({alerts.length})
            </h3>
          </div>
          {loadingObs && <Skeleton className="mt-3 h-24 w-full" />}
          {!loadingObs && alerts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              {obsError ?? "Tidak ada alert aktif."}
            </p>
          )}
          {!loadingObs && alerts.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {alerts.map((alert, i) => {
                const a = alert as Record<string, unknown>;
                const severity = String(a.severity ?? "UNKNOWN");
                const message = String(a.message ?? a.title ?? "Alert");
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-foreground">{message}</span>
                    <Badge
                      variant={
                        severity === "CRITICAL" || severity === "HIGH"
                          ? "danger"
                          : severity === "MEDIUM"
                            ? "warning"
                            : "default"
                      }
                    >
                      {severity}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-xs text-muted-foreground">
          Halaman ini memantau jalur sinkronisasi. Untuk mencatat data saat jaringan
          terputus, gunakan{" "}
          <Link href="/emergency" className="text-primary-600 underline">
            Mode Darurat
          </Link>
          ; untuk menyelesaikan konflik, gunakan{" "}
          <Link href="/offline-sync" className="text-primary-600 underline">
            Sinkronisasi Offline
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
