"use client";

/**
 * Emergency Mode — antrean offline operasional (SoW 3.9.5).
 *
 * Data disimpan di IndexedDB (`src/lib/offline/offline-db.ts`), bukan state
 * memori/data contoh. Saat koneksi pulih, `flushOfflineQueue` mengirim batch
 * ke `POST /api/v1/sync/push` dan hanya menandai record yang dikonfirmasi
 * backend. Konflik/gagal dicatat sebagai Incident Report di audit log.
 */

import { useCallback, useEffect, useState } from "react";
import { Can } from "@/components/can";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { useOnlineStatus } from "@/features/people/hooks/use-online-status";
import {
  enqueueOfflineRecord,
  listOfflineRecords,
  updateOfflineRecord,
  type OfflineEntityType,
  type OfflineRecord,
} from "@/lib/offline/offline-db";
import {
  flushOfflineQueue,
  getOfflineQueueSummary,
  OFFLINE_SYNC_EVENT,
  type OfflineQueueSummary,
} from "@/lib/offline/sync-engine";
import { formatDate } from "@/lib/format";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

/** Tipe catatan darurat yang bisa direkam tanpa koneksi. */
const EMERGENCY_TYPES: Array<{ value: OfflineEntityType; label: string }> = [
  { value: "EMERGENCY_NOTE", label: "Catatan Darurat" },
  { value: "VITAL_SIGN", label: "Tanda Vital" },
  { value: "SOAP_DRAFT", label: "Draft SOAP" },
  { value: "DISPENSING", label: "Dispensing Obat" },
];

const STATUS_BADGE: Record<
  OfflineRecord["status"],
  { label: string; variant: "warning" | "success" | "danger" | "default" }
> = {
  pending: { label: "Menunggu", variant: "warning" },
  syncing: { label: "Mengirim…", variant: "default" },
  synced: { label: "Tersinkron", variant: "success" },
  conflict: { label: "Konflik", variant: "danger" },
  failed: { label: "Gagal", variant: "danger" },
};

function readDescription(record: OfflineRecord): string {
  const description = record.payload.description;
  if (typeof description === "string" && description.trim()) return description;
  const note = record.payload.note;
  if (typeof note === "string" && note.trim()) return note;
  return record.entityType;
}

export default function EmergencyPage() {
  const isOnline = useOnlineStatus();
  const [records, setRecords] = useState<OfflineRecord[]>([]);
  const [summary, setSummary] = useState<OfflineQueueSummary>({
    total: 0,
    pending: 0,
    synced: 0,
    conflict: 0,
    failed: 0,
    lastSyncAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{
    type: OfflineEntityType;
    description: string;
  }>({ type: "EMERGENCY_NOTE", description: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [rows, counts] = await Promise.all([
        listOfflineRecords(),
        getOfflineQueueSummary(),
      ]);
      setRecords(rows);
      setSummary(counts);
    } catch (e) {
      setMessage({
        type: "error",
        text:
          e instanceof Error
            ? `Penyimpanan offline tidak dapat dibuka: ${e.message}`
            : "Penyimpanan offline tidak dapat dibuka.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu tick agar setState tidak sinkron di dalam effect.
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const onSync = () => void refresh();
    window.addEventListener(OFFLINE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(OFFLINE_SYNC_EVENT, onSync);
  }, [refresh]);

  /**
   * Simpan catatan ke IndexedDB terlebih dahulu. Bila online, langsung coba
   * kirim; bila gagal, record tetap tersimpan dan akan dikirim otomatis.
   */
  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      setMessage({ type: "error", text: "Deskripsi catatan wajib diisi." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await enqueueOfflineRecord(formData.type, {
        type: formData.type,
        description: formData.description.trim(),
        recordedAt: new Date().toISOString(),
      });
      setShowModal(false);
      setFormData({ type: "EMERGENCY_NOTE", description: "" });
      await refresh();
      setMessage({
        type: "ok",
        text: isOnline
          ? "Catatan tersimpan di perangkat dan sedang dikirim ke server."
          : "Catatan tersimpan aman di perangkat (IndexedDB).",
      });
      if (isOnline) {
        void flushOfflineQueue().then(() => refresh());
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Gagal menyimpan catatan offline.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await flushOfflineQueue();
      if (result.skipped === "offline") {
        setMessage({ type: "error", text: "Perangkat masih offline. Antrean tetap tersimpan." });
      } else if (result.skipped === "nothing-pending") {
        setMessage({ type: "ok", text: "Tidak ada catatan yang menunggu dikirim." });
      } else if (result.skipped === "device-unregistered") {
        setMessage({
          type: "error",
          text: result.message ?? "Perangkat belum terdaftar di backend.",
        });
      } else {
        setMessage({
          type: "ok",
          text:
            `Terkirim: ${result.synced} dari ${result.attempted} catatan.` +
            (result.conflicts ? ` ${result.conflicts} konflik perlu diselesaikan.` : "") +
            (result.failed ? ` ${result.failed} gagal dan akan dicoba ulang.` : ""),
        });
      }
      await refresh();
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Sinkronisasi gagal. Antrean tetap tersimpan.",
      });
    } finally {
      setSyncing(false);
    }
  };

  /** Coba ulang record yang sudah menyerah (attempts = batas maksimum). */
  const handleRetry = async (record: OfflineRecord) => {
    await updateOfflineRecord(record.id, { status: "pending", attempts: 0, lastError: undefined });
    await refresh();
    if (isOnline) void handleSync();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Emergency Mode</h1>
          <p className="text-sm text-muted-foreground">
            Pencatatan offline dengan antrean IndexedDB dan sinkronisasi otomatis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isOnline ? "success" : "warning"} data-testid="emergency-connectivity">
            {isOnline ? <Wifi className="mr-1 size-3.5" /> : <WifiOff className="mr-1 size-3.5" />}
            {isOnline ? "Online" : "Offline"}
          </Badge>
          <Can action="emergency.create">
            <Button onClick={() => setShowModal(true)}>
              <Plus className="size-4" />
              Catatan Darurat
            </Button>
          </Can>
        </div>
      </div>

      {!isOnline && (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-warning-600" />
            <div>
              <p className="font-medium text-warning-700">Mode Darurat Aktif</p>
              <p className="text-sm text-warning-600">
                Catatan disimpan di IndexedDB perangkat dan dikirim otomatis saat koneksi
                pulih. Jangan membersihkan data situs sebelum antrean kosong.
              </p>
            </div>
          </div>
        </Card>
      )}

      {message && (
        <div
          className={`rounded-xl p-3 text-sm ${
            message.type === "ok"
              ? "bg-success-50 text-success-700"
              : "bg-danger-50 text-danger-700"
          }`}
          role="status"
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{summary.pending}</p>
              <p className="text-xs text-muted-foreground">Menunggu Sinkron</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{summary.synced}</p>
              <p className="text-xs text-muted-foreground">Tersinkron</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {summary.conflict + summary.failed}
              </p>
              <p className="text-xs text-muted-foreground">Konflik / Gagal</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <RefreshCw className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {summary.lastSyncAt ? formatDate(summary.lastSyncAt) : "Belum pernah"}
              </p>
              <p className="text-xs text-muted-foreground">Sinkron Terakhir</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.pending > 0 && (
        <Button onClick={handleSync} disabled={syncing || !isOnline} className="w-full">
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Mengirim…" : `Sinkronkan ${summary.pending} Catatan ke Backend`}
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upgrade Queue (IndexedDB)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat antrean…</p>
          ) : records.length === 0 ? (
            <EmptyState
              title="Antrean kosong"
              description="Catatan yang dibuat saat offline akan muncul di sini dan dikirim otomatis."
              icon={CheckCircle}
            />
          ) : (
            <div className="space-y-2">
              {records.map((record) => {
                const badge = STATUS_BADGE[record.status];
                return (
                  <div
                    key={record.id}
                    className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {readDescription(record)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.entityType} · {formatDate(record.createdAt)} · percobaan{" "}
                        {record.attempts}
                      </p>
                      {(record.lastError || record.conflictReason) && (
                        <p className="mt-1 text-xs text-danger-600">
                          {record.conflictReason ?? record.lastError}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {record.status === "failed" && (
                        <Button variant="outline" onClick={() => void handleRetry(record)}>
                          Coba Lagi
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Catatan Darurat"
        size="sm"
      >
        <div className="space-y-4">
          <Select
            label="Tipe"
            value={formData.type}
            onChange={(e) =>
              setFormData((f) => ({ ...f, type: e.target.value as OfflineEntityType }))
            }
            options={EMERGENCY_TYPES}
          />
          <Input
            label="Deskripsi"
            value={formData.description}
            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
            placeholder="Catatan tindakan darurat…"
          />
          <p className="text-xs text-muted-foreground">
            Data disimpan di perangkat (bukan hanya di memori tab) sehingga tetap aman bila
            aplikasi tertutup.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Can action="emergency.create">
              <Button onClick={() => void handleSubmit()} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
