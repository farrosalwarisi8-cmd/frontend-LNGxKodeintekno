/**
 * Mesin sinkronisasi offline (Upgrade Queue) — SoW 3.9.5.
 *
 * Alur:
 *   1. Record ditulis ke IndexedDB oleh halaman klinis (vital sign, SOAP,
 *      dispensing, catatan darurat) — lihat `offline-db.ts`.
 *   2. Saat koneksi kembali (event `online`, interval, atau aksi pengguna),
 *      mesin mendaftarkan perangkat sekali ke backend
 *      (`POST /sync/register-device`) lalu mengirim antrean sebagai batch
 *      (`POST /sync/push`).
 *   3. Backend menjawab status PER ITEM. Hanya item yang benar-benar
 *      dikonfirmasi yang ditandai `synced`; konflik dan kegagalan dicatat
 *      sebagai Incident Report di audit log — tidak ada "fake success".
 *
 * Catatan keamanan: payload klinis TIDAK pernah ditulis ke console/log.
 */
import {
  MAX_SYNC_ATTEMPTS,
  countOfflineRecords,
  getOfflineMeta,
  listPendingRecords,
  migrateLegacyLocalStorageQueue,
  requeueStuckSyncing,
  setOfflineMeta,
  updateOfflineRecord,
  DEVICE_META_KEY,
  type RegisteredDevice,
} from "@/lib/offline/offline-db";
import { syncService, type SyncPushResultItem } from "@/lib/services/sync.service";
import { deviceFingerprintHash } from "@/shared/utils/device-fingerprint";
import { getDefaultSiteCode } from "@/lib/env";

/** Kode site default untuk pendaftaran perangkat (override via env). */
const DEFAULT_SITE_CODE = getDefaultSiteCode();

export interface SyncIncident {
  type: "conflict" | "failed" | "batch-failed";
  recordId: string;
  entityType: string;
  message: string;
  at: string;
}

export type IncidentSink = (incident: SyncIncident) => void | Promise<void>;

/**
 * Sink default: tulis Incident Report ke audit log aplikasi.
 *
 * Import store dilakukan dinamis agar modul ini tetap bisa diuji tanpa
 * menyentuh localStorage/persist middleware zustand.
 */
const defaultIncidentSink: IncidentSink = async (incident) => {
  const { useStore } = await import("@/lib/store");
  const state = useStore.getState();
  const actor = state.users.find((u) => u.id === state.currentUserId);
  const entry = {
    id: `inc-${incident.recordId}-${incident.at}`,
    userId: state.currentUserId ?? "",
    userName: actor?.name ?? "SYSTEM",
    action: `OFFLINE_SYNC_${incident.type.toUpperCase().replace("-", "_")}`,
    objectType: "OfflineQueue",
    objectId: incident.recordId,
    before: undefined,
    after: incident.entityType,
    reason: incident.message,
    at: incident.at,
  };
  useStore.setState((s) => ({ auditLogs: [entry, ...s.auditLogs] }));
};

export interface FlushResult {
  attempted: number;
  synced: number;
  conflicts: number;
  failed: number;
  skipped?: "offline" | "nothing-pending" | "device-unregistered";
  message?: string;
}

/** Ukuran batch agar payload push tetap wajar untuk jaringan edge. */
const BATCH_SIZE = 50;

/** Status sukses yang dipakai backend Domain 11. */
const SUCCESS_STATUSES = new Set([
  "SYNCED",
  "APPLIED",
  "OK",
  "SUCCESS",
  "CREATED",
  "IDEMPOTENT_SKIPPED",
  "DUPLICATE",
]);

/** Klasifikasi status per item dari `POST /sync/push`. */
export function classifyPushStatus(
  rawStatus: string | undefined
): "synced" | "conflict" | "failed" {
  const status = (rawStatus ?? "").toUpperCase();
  if (SUCCESS_STATUSES.has(status)) return "synced";
  if (status === "CONFLICT") return "conflict";
  return "failed";
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function currentlyOnline(): boolean {
  if (!isBrowser()) return false;
  return navigator.onLine !== false;
}

/**
 * Daftarkan perangkat bila belum terdaftar (idempoten per fingerprint + site).
 * Backend menerima `deviceFingerprintHash`; id hasil registrasi disimpan di
 * IndexedDB agar push berikutnya tidak mendaftar ulang.
 */
export async function ensureDeviceRegistration(
  siteCode: string = DEFAULT_SITE_CODE
): Promise<RegisteredDevice> {
  const existing = await getOfflineMeta<RegisteredDevice>(DEVICE_META_KEY);
  if (existing && existing.deviceId && existing.siteCode === siteCode) {
    return existing;
  }

  const fingerprint = await deviceFingerprintHash();
  const res = await syncService.registerDevice(fingerprint, siteCode);
  const deviceId =
    (typeof res.id === "string" && res.id) ||
    (typeof res.device_id === "string" && res.device_id) ||
    (typeof res.deviceId === "string" && res.deviceId) ||
    "";
  if (!deviceId) {
    throw new Error("Backend tidak mengembalikan ID perangkat. Sinkronisasi ditunda.");
  }

  const device: RegisteredDevice = {
    deviceId,
    siteCode,
    fingerprint,
    registeredAt: new Date().toISOString(),
  };
  await setOfflineMeta(DEVICE_META_KEY, device);
  return device;
}

let inFlight: Promise<FlushResult> | null = null;

/**
 * Kirim antrean offline ke backend. Aman dipanggil berkali-kali: panggilan
 * paralel berbagi promise yang sama sehingga tidak ada double-push
 * (double-dispensing) saat event `online` dan tombol pengguna bertabrakan.
 */
export function flushOfflineQueue(options: {
  siteCode?: string;
  incidentSink?: IncidentSink;
} = {}): Promise<FlushResult> {
  if (inFlight) return inFlight;
  inFlight = runFlush(options).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(options: {
  siteCode?: string;
  incidentSink?: IncidentSink;
}): Promise<FlushResult> {
  const reportIncident = options.incidentSink ?? defaultIncidentSink;

  if (!currentlyOnline()) {
    return { attempted: 0, synced: 0, conflicts: 0, failed: 0, skipped: "offline" };
  }

  // Migrasi sekali dari antrean localStorage lama; record lama tidak hilang.
  await migrateLegacyLocalStorageQueue().catch(() => 0);
  // Tab yang ditutup saat push meninggalkan status `syncing`; kembalikan.
  await requeueStuckSyncing().catch(() => 0);

  const pending = (await listPendingRecords()).slice(0, BATCH_SIZE);
  if (pending.length === 0) {
    return { attempted: 0, synced: 0, conflicts: 0, failed: 0, skipped: "nothing-pending" };
  }

  let device: RegisteredDevice;
  try {
    device = await ensureDeviceRegistration(options.siteCode);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gagal mendaftarkan perangkat.";
    // Record tidak dinaikkan attempts-nya: ini masalah konfigurasi/koneksi,
    // bukan data yang ditolak backend.
    await reportIncident({
      type: "batch-failed",
      recordId: "device-registration",
      entityType: "DEVICE",
      message,
      at: new Date().toISOString(),
    });
    return {
      attempted: pending.length,
      synced: 0,
      conflicts: 0,
      failed: 0,
      skipped: "device-unregistered",
      message,
    };
  }

  await Promise.all(pending.map((r) => updateOfflineRecord(r.id, { status: "syncing" })));

  let response;
  try {
    response = await syncService.push(
      device.deviceId,
      pending.map((record) => ({
        localRecordId: record.id,
        entityType: record.entityType,
        payload: {
          ...record.payload,
          // Jejak waktu perekaman offline ikut dikirim agar backend dapat
          // mengurutkan kejadian meski diterima lebih lambat.
          recordedAt: record.createdAt,
        },
      }))
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Push batch gagal.";
    await Promise.all(
      pending.map((record) =>
        updateOfflineRecord(record.id, {
          status: record.attempts + 1 >= MAX_SYNC_ATTEMPTS ? "failed" : "pending",
          attempts: record.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
          lastError: message,
        })
      )
    );
    await reportIncident({
      type: "batch-failed",
      recordId: pending.map((r) => r.id).join(","),
      entityType: "BATCH",
      message,
      at: new Date().toISOString(),
    });
    return { attempted: pending.length, synced: 0, conflicts: 0, failed: pending.length, message };
  }

  const resultById = new Map<string, SyncPushResultItem>();
  for (const item of response.results ?? []) {
    if (item.localRecordId) resultById.set(item.localRecordId, item);
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  for (const record of pending) {
    const item = resultById.get(record.id);
    // Item tanpa hasil dianggap gagal-untuk-sementara: tetap di antrean.
    const outcome = item ? classifyPushStatus(item.status) : "failed";
    const now = new Date().toISOString();
    const message =
      item?.message ?? item?.reason ?? "Backend tidak mengembalikan status untuk record ini.";

    if (outcome === "synced") {
      synced += 1;
      await updateOfflineRecord(record.id, {
        status: "synced",
        attempts: record.attempts + 1,
        lastAttemptAt: now,
        lastError: undefined,
        serverStatus: (item?.status ?? "").toUpperCase(),
      });
      continue;
    }

    if (outcome === "conflict") {
      conflicts += 1;
      await updateOfflineRecord(record.id, {
        status: "conflict",
        attempts: record.attempts + 1,
        lastAttemptAt: now,
        serverStatus: (item?.status ?? "").toUpperCase(),
        conflictReason: message,
      });
      await reportIncident({
        type: "conflict",
        recordId: record.id,
        entityType: record.entityType,
        message,
        at: now,
      });
      continue;
    }

    failed += 1;
    const attempts = record.attempts + 1;
    const exhausted = attempts >= MAX_SYNC_ATTEMPTS;
    await updateOfflineRecord(record.id, {
      status: exhausted ? "failed" : "pending",
      attempts,
      lastAttemptAt: now,
      lastError: message,
      serverStatus: (item?.status ?? "NO_RESULT").toUpperCase(),
    });
    // Incident hanya dicatat saat record benar-benar berhenti dicoba, agar
    // audit log tidak banjir oleh kegagalan jaringan sesaat.
    if (exhausted) {
      await reportIncident({
        type: "failed",
        recordId: record.id,
        entityType: record.entityType,
        message,
        at: now,
      });
    }
  }

  return { attempted: pending.length, synced, conflicts, failed };
}

export interface OfflineQueueSummary {
  total: number;
  pending: number;
  synced: number;
  conflict: number;
  failed: number;
  lastSyncAt: string | null;
}

const LAST_SYNC_META_KEY = "last-sync-at";

export async function getOfflineQueueSummary(): Promise<OfflineQueueSummary> {
  const counts = await countOfflineRecords();
  const lastSyncAt = (await getOfflineMeta<string>(LAST_SYNC_META_KEY)) ?? null;
  return { ...counts, lastSyncAt };
}

/** Hapus record yang sudah terkonfirmasi backend (housekeeping manual). */
export async function purgeSyncedRecords(): Promise<number> {
  const { clearSyncedRecords } = await import("@/lib/offline/offline-db");
  return clearSyncedRecords();
}

/** Event browser agar komponen UI memuat ulang daftar antrean. */
export const OFFLINE_SYNC_EVENT = "kodein:offline-sync";

function emitSyncEvent(result: FlushResult): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<FlushResult>(OFFLINE_SYNC_EVENT, { detail: result }));
  if (result.synced > 0) {
    void setOfflineMeta(LAST_SYNC_META_KEY, new Date().toISOString());
  }
}

/**
 * Aktifkan sinkronisasi otomatis:
 * - saat browser kembali online,
 * - saat tab kembali terlihat (edge device sering ditutup sementara),
 * - setiap 60 detik selama online.
 *
 * Mengembalikan fungsi untuk menghentikan semua listener.
 */
export function startOfflineAutoSync(options: { siteCode?: string } = {}): () => void {
  if (!isBrowser()) return () => {};
  let stopped = false;

  const run = () => {
    if (stopped || !currentlyOnline()) return;
    void flushOfflineQueue(options)
      .then(emitSyncEvent)
      .catch(() => {
        // Kegagalan sudah dicatat sebagai incident; jangan crash aplikasi.
      });
  };

  const onOnline = () => run();
  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(run, 60_000);
  // Percobaan awal ditunda sedikit agar tidak berebut dengan splash/fetch awal.
  const initial = window.setTimeout(run, 3_000);

  return () => {
    stopped = true;
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
    window.clearTimeout(initial);
  };
}

