"use client";

/**
 * Sinkronisasi Offline — endpoint backend Domain 11:
 *   POST /api/v1/sync/register-device   { deviceFingerprintHash, siteCode }
 *   POST /api/v1/sync/push              { deviceId, items[] }
 *   GET  /api/v1/sync/pull?since=&siteCode=
 *   GET  /api/v1/sync/conflicts?deviceId=
 *   POST /api/v1/sync/conflicts/:id/resolve
 *
 * Halaman ini mendaftarkan perangkat ke backend, menampilkan konflik yang
 * menunggu keputusan manual, dan mengizinkan penyelesaiannya (dokter OH /
 * admin). Record yang terekam offline dikirim lewat antrean lokal
 * (`src/lib/offline-queue.ts`) — tombol Kirim Batch memproses antrean itu.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  syncService,
  type SyncConflict,
  type SyncResolutionAction,
} from "@/lib/services/sync.service";
import {
  flushOfflineQueue,
  getOfflineQueueSummary,
  purgeSyncedRecords,
  OFFLINE_SYNC_EVENT,
  type OfflineQueueSummary,
} from "@/lib/offline/sync-engine";
import { deviceFingerprintHash } from "@/shared/utils/device-fingerprint";
import {
  RefreshCw,
  Smartphone,
  UploadCloud,
  DownloadCloud,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

/** Entity types yang diketahui (dipakai dropdown resolusi konflik). */
const ENTITY_TYPES = ["VITAL_SIGN", "ENCOUNTER", "MCU_CYCLE", "SOAP_NOTE"];

const RESOLUTION_LABEL: Record<SyncResolutionAction, string> = {
  ACCEPT_SERVER: "Pakai data server",
  ACCEPT_DEVICE: "Pakai data perangkat",
  MERGE: "Gabungkan kedua data",
};

export default function OfflineSyncPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [siteCode, setSiteCode] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);

  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [loadingConflicts, setLoadingConflicts] = useState(true);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [resolveTarget, setResolveTarget] = useState<SyncConflict | null>(null);
  const [resolution, setResolution] = useState<SyncResolutionAction>("ACCEPT_SERVER");
  const [resolveNote, setResolveNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState<string | null>(null);

  // Batch push dari antrean offline lokal (IndexedDB).
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [queueSummary, setQueueSummary] = useState<OfflineQueueSummary>({
    total: 0,
    pending: 0,
    synced: 0,
    conflict: 0,
    failed: 0,
    lastSyncAt: null,
  });

  const loadConflicts = useCallback(async () => {
    setLoadingConflicts(true);
    setConflictError(null);
    try {
      const rows = await syncService.listConflicts(deviceId ?? undefined);
      setConflicts(rows);
    } catch (e) {
      setConflictError(e instanceof Error ? e.message : "Gagal memuat konflik sinkronisasi.");
    } finally {
      setLoadingConflicts(false);
    }
  }, [deviceId]);

  const loadSummary = useCallback(async () => {
    try {
      setQueueSummary(await getOfflineQueueSummary());
    } catch {
      // IndexedDB tidak tersedia (mode privat ketat) — kartu antrean tetap 0.
    }
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => {
      void loadConflicts();
      void loadSummary();
    }, 0);
    const onSync = () => void loadSummary();
    window.addEventListener(OFFLINE_SYNC_EVENT, onSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(OFFLINE_SYNC_EVENT, onSync);
    };
  }, [loadConflicts, loadSummary]);

  const handleRegister = async () => {
    setRegistering(true);
    setRegisterMsg(null);
    try {
      const hash = fingerprint ?? (await deviceFingerprintHash());
      setFingerprint(hash);
      if (!siteCode.trim()) {
        setRegisterMsg("Site code wajib diisi untuk mendaftarkan perangkat.");
        return;
      }
      const res = await syncService.registerDevice(hash, siteCode.trim());
      // Backend dapat mengembalikan id device dengan nama berbeda.
      const id =
        (res.id as string | undefined) ??
        (res.device_id as string | undefined) ??
        (res.deviceId as string | undefined) ??
        null;
      setDeviceId(id);
      setRegisterMsg(
        id ? "Perangkat terdaftar. Batch push dapat dikirim." : "Perangkat terdaftar di backend."
      );
      await loadConflicts();
    } catch (e) {
      setRegisterMsg(e instanceof Error ? e.message : "Gagal mendaftarkan perangkat.");
    } finally {
      setRegistering(false);
    }
  };

  /**
   * Kirim antrean offline (IndexedDB) lewat mesin sinkronisasi.
   *
   * Sebelumnya halaman ini mengosongkan seluruh antrean localStorage setelah
   * push — termasuk item yang ditolak backend (kehilangan data). Sekarang
   * status per item dari backend yang menentukan: hanya item terkonfirmasi
   * yang ditandai tersinkron, sisanya tetap di antrean.
   */
  const handlePushQueue = async () => {
    setPushing(true);
    setPushMsg(null);
    setPushError(null);
    try {
      const result = await flushOfflineQueue({
        siteCode: siteCode.trim() || undefined,
      });
      if (result.skipped === "offline") {
        setPushError("Perangkat sedang offline. Antrean tetap tersimpan.");
      } else if (result.skipped === "nothing-pending") {
        setPushMsg("Tidak ada record offline yang menunggu dikirim.");
      } else if (result.skipped === "device-unregistered") {
        setPushError(result.message ?? "Perangkat gagal didaftarkan.");
      } else {
        setPushMsg(
          `Batch diproses: ${result.synced} tersinkron dari ${result.attempted} item` +
            (result.conflicts ? `, ${result.conflicts} konflik` : "") +
            (result.failed ? `, ${result.failed} gagal (akan dicoba ulang)` : "") +
            "."
        );
        if (result.synced > 0) await loadSummary();
      }
      await loadConflicts();
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Gagal mengirim batch sinkronisasi.");
    } finally {
      setPushing(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    setResolveError(null);
    setResolveMsg(null);
    try {
      await syncService.resolveConflict(resolveTarget.id, resolution, resolveNote || undefined);
      setResolveMsg("Konflik diselesaikan.");
      setResolveTarget(null);
      setResolveNote("");
      await loadConflicts();
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Gagal menyelesaikan konflik.");
    } finally {
      setResolving(false);
    }
  };

  const openConflicts = conflicts.filter(
    (c) => (c.status ?? "CONFLICT").toUpperCase() === "CONFLICT"
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sinkronisasi Offline</h1>
        <p className="text-sm text-muted-foreground">
          Daftarkan perangkat, kirim record yang terekam offline, dan selesaikan konflik
        </p>
      </div>

      {/* Pendaftaran perangkat */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Perangkat</h2>
            <p className="text-xs text-muted-foreground">
              Fingerprint dibuat dari atribut perangkat (tanpa identitas pengguna) dan
              dipakai backend untuk mengaitkan record yang di-push.
            </p>
            {fingerprint && (
              <p className="font-mono text-xs text-muted-foreground" data-testid="device-fingerprint">
                {fingerprint.slice(0, 16)}…
              </p>
            )}
            {deviceId && (
              <Badge variant="success" className="mt-1">
                Terdaftar · {deviceId.slice(0, 8)}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input
              label="Site Code"
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              placeholder="SITE-PLANT-01"
            />
            <Button onClick={handleRegister} disabled={registering}>
              {registering ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Smartphone className="size-4" />
              )}
              {deviceId ? "Daftarkan Ulang" : "Daftarkan"}
            </Button>
          </div>
        </div>
        {registerMsg && (
          <p className="mt-3 text-sm text-muted-foreground">{registerMsg}</p>
        )}
      </Card>

      {/* Batch push antrean offline */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Kirim Record Offline</h2>
            <p className="text-xs text-muted-foreground">
              Antrean IndexedDB di perangkat ini: {queueSummary.pending} menunggu ·{" "}
              {queueSummary.synced} tersinkron · {queueSummary.conflict} konflik ·{" "}
              {queueSummary.failed} gagal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {queueSummary.synced > 0 && (
              <Button
                variant="ghost"
                onClick={async () => {
                  await purgeSyncedRecords();
                  await loadSummary();
                }}
              >
                Bersihkan Tersinkron
              </Button>
            )}
            <Button variant="outline" onClick={handlePushQueue} disabled={pushing}>
              {pushing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              Kirim Batch
            </Button>
          </div>
        </div>
        {pushMsg && <p className="mt-3 text-sm text-success-600">{pushMsg}</p>}
        {pushError && <p className="mt-3 text-sm text-danger-600">{pushError}</p>}
        {!deviceId && (
          <p className="mt-3 text-xs text-muted-foreground">
            Perangkat didaftarkan otomatis saat batch pertama dikirim. Site code di atas
            dipakai untuk pendaftaran tersebut.
          </p>
        )}
      </Card>

      {/* Daftar konflik */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Konflik Sinkronisasi ({openConflicts.length})
        </h2>
        <Button variant="ghost" onClick={loadConflicts} disabled={loadingConflicts}>
          <RefreshCw className={`size-4 ${loadingConflicts ? "animate-spin" : ""}`} />
          Muat Ulang
        </Button>
      </div>

      {loadingConflicts && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

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
          description="Semua record offline sudah selaras dengan server."
          icon={CheckCircle}
        />
      )}

      {!loadingConflicts && !conflictError && openConflicts.length > 0 && (
        <div className="space-y-3">
          {openConflicts.map((conflict) => {
            const queue = conflict.offline_queue;
            const entityType = queue?.entity_type ?? "—";
            return (
              <Card key={conflict.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-warning-600" />
                      <p className="font-medium text-foreground">{entityType}</p>
                      <Badge variant="warning">Konflik</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Record lokal: {queue?.local_record_id ?? "—"} · tercatat{" "}
                      {formatDate(conflict.synced_at ?? "")}
                    </p>
                  </div>
                  <Can action="mcu.review">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResolveTarget(conflict);
                        setResolveError(null);
                        setResolveMsg(null);
                      }}
                    >
                      Selesaikan
                    </Button>
                  </Can>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {resolveTarget && (
        <Modal
          open
          onClose={() => setResolveTarget(null)}
          title="Selesaikan Konflik Sinkronisasi"
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pilih data mana yang dipakai untuk record{" "}
              <span className="font-mono text-xs">
                {resolveTarget.offline_queue?.local_record_id ?? resolveTarget.id}
              </span>
              .
            </p>
            <Select
              label="Keputusan"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as SyncResolutionAction)}
              options={(Object.keys(RESOLUTION_LABEL) as SyncResolutionAction[]).map(
                (action) => ({ value: action, label: RESOLUTION_LABEL[action] })
              )}
            />
            <Input
              label="Catatan (opsional)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="Alasan keputusan"
            />
            {resolveError && <p className="text-xs text-danger-600">{resolveError}</p>}
            {resolveMsg && <p className="text-xs text-success-600">{resolveMsg}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolveTarget(null)}>
                Batal
              </Button>
              <Button onClick={handleResolve} disabled={resolving}>
                {resolving ? "Menyimpan..." : "Simpan Keputusan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Info tipe entitas yang didukung push */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <DownloadCloud className="mt-0.5 size-4 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">Tipe entitas yang dikirim</h3>
            <div className="flex flex-wrap gap-2">
              {ENTITY_TYPES.map((type) => (
                <Badge key={type} variant="default">
                  {type}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Backend memproses push per item dan menandai yang berkonflik; item tersebut
              muncul di daftar konflik untuk keputusan manual.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
