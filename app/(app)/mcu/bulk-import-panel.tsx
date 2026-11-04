"use client";

/**
 * Panel impor massal siklus MCU — endpoint backend
 *   POST /api/v1/mcu/cycles/bulk-import           (enqueue job)
 *   GET  /api/v1/mcu/cycles/bulk-import/:jobId/status  (poll progres)
 *
 * Backend menjalankan impor secara asinkron: POST hanya mengembalikan
 * `jobId` + status `QUEUED`, progres dibaca dari endpoint status. Panel ini
 * melakukan polling sampai status terminal (COMPLETED/FAILED) dengan batas
 * waktu agar tidak menggantung tanpa henti.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { mcuService, type BulkImportJobStatus } from "@/lib/services/mcu.service";
import { FileUp, Loader2, RefreshCw } from "lucide-react";

/** Status job yang dianggap selesai (tidak dipoll lagi). */
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "ERROR"]);

/** Batas polling (ms) — mencegah request berjalan tanpa henti. */
const POLL_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3000;

export default function McuBulkImportPanel() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BulkImportJobStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const startImport = useCallback(async () => {
    setStarting(true);
    setError(null);
    setMessage(null);
    setJob(null);
    try {
      const res = await mcuService.startBulkImport();
      setJobId(res.jobId);
      setMessage(res.message ?? "Impor massal MCU dimulai.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulai impor massal.");
    } finally {
      setStarting(false);
    }
  }, []);

  // Polling status job: berhenti pada status terminal atau batas waktu.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const status = await mcuService.getBulkImportStatus(jobId);
        if (cancelled) return;
        setJob(status);
        if (TERMINAL_STATUSES.has((status.status ?? "").toUpperCase())) return;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Gagal membaca status impor.");
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (!cancelled) setError("Waktu tunggu status impor habis. Coba lagi nanti.");
        return;
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    let timer = setTimeout(() => void poll(), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const isRunning =
    job !== null && !TERMINAL_STATUSES.has((job.status ?? "").toUpperCase());

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Impor Massal MCU</h2>
          <p className="text-xs text-muted-foreground">
            Kirim impor MCU massal (Excel/CSV) ke antrean backend, lalu pantau
            progres job sampai selesai.
          </p>
        </div>
        <Can action="mcu.create">
          <Button variant="outline" onClick={startImport} disabled={starting || isRunning}>
            {starting || isRunning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {starting ? "Mengirim..." : "Mulai Impor"}
          </Button>
        </Can>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {message && !job && (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</div>
      )}

      {isRunning && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="size-3 animate-spin" />
            Memantau job {jobId}…
          </p>
        </div>
      )}

      {job && !isRunning && (
        <CardContent className="mt-3 space-y-2 p-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                (job.status ?? "").toUpperCase() === "COMPLETED" ? "success" : "danger"
              }
            >
              {job.status ?? "—"}
            </Badge>
            <span className="text-xs text-muted-foreground">Job: {job.jobId}</span>
          </div>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt className="font-medium text-foreground">Total baris</dt>
              <dd>{job.totalRows ?? 0}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Diproses</dt>
              <dd>{job.processed ?? 0}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Gagal</dt>
              <dd>{job.failed ?? 0}</dd>
            </div>
          </dl>
          {Array.isArray(job.errors) && job.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-danger-600">
              {job.errors.map((err, i) => (
                <li key={i}>{typeof err === "string" ? err : JSON.stringify(err)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      )}

      {job?.status && TERMINAL_STATUSES.has(job.status.toUpperCase()) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Selesai {formatDate(new Date().toISOString())}
        </p>
      )}
    </Card>
  );
}
