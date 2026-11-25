/**
 * Penyimpanan antrean offline berbasis IndexedDB (SoW 3.9.5 — Emergency Mode).
 *
 * Mengapa IndexedDB, bukan localStorage:
 * - localStorage bersifat sinkron, berbagi kuota ~5 MB dengan state UI, dan
 *   mudah hilang saat pengguna membersihkan data situs. Draft SOAP + tanda
 *   vital + dispensing bisa melebihi kuota itu.
 * - IndexedDB menyimpan objek terstruktur (tanpa serialisasi manual), punya
 *   transaksi, dan kapasitas jauh lebih besar sehingga aman untuk 48 jam
 *   operasi offline.
 *
 * Setiap record membawa `id` lokal (uuid) yang dipakai sebagai
 * `localRecordId` saat push ke backend, sehingga backend dapat melakukan
 * deduplikasi idempoten ketika antrean dikirim ulang.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export const OFFLINE_DB_NAME = "kodein-emr-offline";
export const OFFLINE_DB_VERSION = 1;
/** Kunci lama (localStorage) yang dimigrasikan otomatis sekali. */
export const LEGACY_QUEUE_STORAGE_KEY = "kodein-klinik-offline-queue";

/** Jenis data klinis yang boleh direkam saat offline. */
export type OfflineEntityType =
  | "VITAL_SIGN"
  | "SOAP_DRAFT"
  | "DISPENSING"
  | "EMERGENCY_NOTE"
  | "MCU_SUBMISSION";

export type OfflineRecordStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export interface OfflineRecord {
  /** uuid v4, dipakai juga sebagai `localRecordId` saat push. */
  id: string;
  entityType: OfflineEntityType;
  /** Isi formulir apa adanya (vital sign, SOAP draft, item dispensing). */
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: OfflineRecordStatus;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  /** Status mentah dari backend pada push terakhir (untuk audit/UI). */
  serverStatus?: string;
  /** Catatan konflik dari backend (bila ada). */
  conflictReason?: string;
}

/** Metadata perangkat & penanda migrasi (bukan data klinis). */
export interface OfflineMeta {
  key: string;
  value: unknown;
}

interface OfflineSchema extends DBSchema {
  outbox: {
    key: string;
    value: OfflineRecord;
    indexes: { "by-status": OfflineRecordStatus; "by-created": string };
  };
  meta: {
    key: string;
    value: OfflineMeta;
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

/** Apakah IndexedDB tersedia (SSR/test tanpa polyfill). */
export function isOfflineDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  if (!isOfflineDbAvailable()) {
    return Promise.reject(new Error("IndexedDB tidak tersedia pada environment ini."));
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("by-status", "status");
          outbox.createIndex("by-created", "createdAt");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/** Tutup koneksi & buang cache promise (dipakai unit test). */
export async function resetOfflineDbForTests(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

function newLocalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback deterministik-cukup untuk browser lama (tanpa crypto.randomUUID).
  return `off-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Simpan satu record ke antrean offline.
 * Selalu `pending` — status `syncing` hanya ditulis mesin sinkronisasi.
 */
export async function enqueueOfflineRecord(
  entityType: OfflineEntityType,
  payload: Record<string, unknown>
): Promise<OfflineRecord> {
  const now = new Date().toISOString();
  const record: OfflineRecord = {
    id: newLocalId(),
    entityType,
    payload,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    attempts: 0,
  };
  const db = await getOfflineDb();
  await db.put("outbox", record);
  return record;
}

/** Semua record, terbaru lebih dulu. */
export async function listOfflineRecords(): Promise<OfflineRecord[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("outbox", "by-created");
  return rows.reverse();
}

/** Batas percobaan sebelum record ditandai gagal permanen (tidak dihapus). */
export const MAX_SYNC_ATTEMPTS = 5;

/** Record yang masih harus dikirim (termasuk yang tertinggal di status syncing
 * karena tab ditutup di tengah proses — lihat `requeueStuckSyncing`). */
export async function listPendingRecords(): Promise<OfflineRecord[]> {
  const db = await getOfflineDb();
  const statuses: OfflineRecordStatus[] = ["pending", "syncing", "failed"];
  const groups = await Promise.all(
    statuses.map((status) => db.getAllFromIndex("outbox", "by-status", status))
  );
  return groups
    .flat()
    .filter((record) => record.status !== "failed" || record.attempts < MAX_SYNC_ATTEMPTS)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getOfflineRecord(id: string): Promise<OfflineRecord | undefined> {
  const db = await getOfflineDb();
  return db.get("outbox", id);
}

export async function updateOfflineRecord(
  id: string,
  patch: Partial<Omit<OfflineRecord, "id">>
): Promise<OfflineRecord | undefined> {
  const db = await getOfflineDb();
  const tx = db.transaction("outbox", "readwrite");
  const current = await tx.store.get(id);
  if (!current) {
    await tx.done;
    return undefined;
  }
  const next: OfflineRecord = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  await tx.store.put(next);
  await tx.done;
  return next;
}

/** Record dihapus hanya setelah backend mengonfirmasi item tersebut. */
export async function deleteOfflineRecord(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete("outbox", id);
}

export async function countOfflineRecords(): Promise<{
  total: number;
  pending: number;
  synced: number;
  conflict: number;
  failed: number;
}> {
  const db = await getOfflineDb();
  const rows = await db.getAll("outbox");
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending" || r.status === "syncing").length,
    synced: rows.filter((r) => r.status === "synced").length,
    conflict: rows.filter((r) => r.status === "conflict").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}

/**
 * Record `syncing` yang tertinggal (tab ditutup / crash saat push) dikembalikan
 * ke `pending` agar tidak hilang dari antrean selamanya.
 */
export async function requeueStuckSyncing(): Promise<number> {
  const db = await getOfflineDb();
  const tx = db.transaction("outbox", "readwrite");
  const stuck = await tx.store.index("by-status").getAll("syncing");
  for (const record of stuck) {
    await tx.store.put({ ...record, status: "pending", updatedAt: new Date().toISOString() });
  }
  await tx.done;
  return stuck.length;
}

/** Hapus record yang sudah tersinkron (dipanggil manual dari halaman sync). */
export async function clearSyncedRecords(): Promise<number> {
  const db = await getOfflineDb();
  const tx = db.transaction("outbox", "readwrite");
  const synced = await tx.store.index("by-status").getAll("synced");
  for (const record of synced) await tx.store.delete(record.id);
  await tx.done;
  return synced.length;
}

export async function getOfflineMeta<T>(key: string): Promise<T | undefined> {
  const db = await getOfflineDb();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

export async function setOfflineMeta(key: string, value: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put("meta", { key, value });
}

/** Perangkat yang sudah terdaftar di backend (`POST /sync/register-device`). */
export interface RegisteredDevice {
  deviceId: string;
  siteCode: string;
  fingerprint: string;
  registeredAt: string;
}

export const DEVICE_META_KEY = "device-registration";
export const LEGACY_MIGRATION_META_KEY = "legacy-queue-migrated";

/**
 * Migrasi sekali dari antrean localStorage lama (`kodein-klinik-offline-queue`).
 * Aksi yang tadinya hanya berisi nama aksi + args dipetakan ke entity type
 * yang setara; record yang tidak dimigrasikan tetap tersimpan di localStorage
 * (tidak dihapus) agar tidak ada kehilangan data secara diam-diam.
 */
export async function migrateLegacyLocalStorageQueue(): Promise<number> {
  if (typeof localStorage === "undefined") return 0;
  if (await getOfflineMeta<boolean>(LEGACY_MIGRATION_META_KEY)) return 0;

  let migrated = 0;
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed as Array<Record<string, unknown>>) {
          const action = String(item.action ?? "");
          const entityType: OfflineEntityType =
            action === "dispense"
              ? "DISPENSING"
              : action === "submitMCU"
                ? "MCU_SUBMISSION"
                : action === "updateVisit"
                  ? "SOAP_DRAFT"
                  : "EMERGENCY_NOTE";
          await enqueueOfflineRecord(entityType, {
            legacyAction: action,
            legacyArgs: item.args ?? [],
            legacyAttemptedAt: item.attemptedAt ?? null,
          });
          migrated += 1;
        }
      }
    }
  } catch {
    // Data lama rusak — jangan blokir aplikasi; tandai sudah dicoba.
  }
  await setOfflineMeta(LEGACY_MIGRATION_META_KEY, true);
  return migrated;
}
