import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SYNC_ATTEMPTS,
  clearSyncedRecords,
  countOfflineRecords,
  deleteOfflineRecord,
  enqueueOfflineRecord,
  listOfflineRecords,
  listPendingRecords,
  migrateLegacyLocalStorageQueue,
  requeueStuckSyncing,
  resetOfflineDbForTests,
  updateOfflineRecord,
  getOfflineMeta,
  LEGACY_MIGRATION_META_KEY,
  LEGACY_QUEUE_STORAGE_KEY,
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
} from "../offline-db";
import { classifyPushStatus } from "../sync-engine";

/** Reset database + localStorage antar test. */
async function resetDb() {
  await resetOfflineDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(OFFLINE_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

const storage = new Map<string, string>();

beforeEach(async () => {
  await resetDb();
  storage.clear();
  globalThis.localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: () => null,
  } as unknown as Storage;
});

describe("offline-db (IndexedDB)", () => {
  it("menyimpan record sebagai pending dengan id lokal stabil", async () => {
    const record = await enqueueOfflineRecord("SOAP_DRAFT", { note: "demam" });
    expect(record.id).toBeTruthy();
    expect(record.status).toBe("pending");
    expect(record.attempts).toBe(0);

    const rows = await listOfflineRecords();
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.note).toBe("demam");
  });

  it("hanya mengembalikan record yang belum tersinkron sebagai pending", async () => {
    const a = await enqueueOfflineRecord("VITAL_SIGN", { bp: "120/80" });
    const b = await enqueueOfflineRecord("DISPENSING", { items: [] });
    await updateOfflineRecord(a.id, { status: "synced" });

    const pending = await listPendingRecords();
    expect(pending.map((r) => r.id)).toEqual([b.id]);
  });

  it("mengembalikan record syncing yang tertinggal ke pending", async () => {
    const record = await enqueueOfflineRecord("EMERGENCY_NOTE", { description: "x" });
    await updateOfflineRecord(record.id, { status: "syncing" });

    await expect(requeueStuckSyncing()).resolves.toBe(1);
    const rows = await listOfflineRecords();
    expect(rows[0].status).toBe("pending");
  });

  it("menghitung status dan membersihkan record tersinkron", async () => {
    const a = await enqueueOfflineRecord("VITAL_SIGN", {});
    await enqueueOfflineRecord("SOAP_DRAFT", {});
    const c = await enqueueOfflineRecord("DISPENSING", {});
    await updateOfflineRecord(a.id, { status: "synced" });
    await updateOfflineRecord(c.id, { status: "conflict" });

    await expect(countOfflineRecords()).resolves.toEqual({
      total: 3,
      pending: 1,
      synced: 1,
      conflict: 1,
      failed: 0,
    });

    await expect(clearSyncedRecords()).resolves.toBe(1);
    await expect(countOfflineRecords()).resolves.toMatchObject({ total: 2, synced: 0 });
  });

  it("menghapus record berdasarkan id", async () => {
    const record = await enqueueOfflineRecord("EMERGENCY_NOTE", {});
    await deleteOfflineRecord(record.id);
    await expect(listOfflineRecords()).resolves.toEqual([]);
  });

  it("memigrasikan antrean localStorage lama satu kali", async () => {
    storage.set(
      LEGACY_QUEUE_STORAGE_KEY,
      JSON.stringify([
        { id: "oq1", action: "dispense", args: ["v1", []], attemptedAt: "2026-09-01T00:00:00Z" },
        { id: "oq2", action: "updateVisit", args: ["v1", {}] },
      ])
    );

    await expect(migrateLegacyLocalStorageQueue()).resolves.toBe(2);
    const rows = await listOfflineRecords();
    expect(rows.map((r) => r.entityType).sort()).toEqual(["DISPENSING", "SOAP_DRAFT"]);

    // Pemanggilan kedua tidak menggandakan record.
    await expect(migrateLegacyLocalStorageQueue()).resolves.toBe(0);
    await expect(listOfflineRecords()).resolves.toHaveLength(2);
    await expect(getOfflineMeta<boolean>(LEGACY_MIGRATION_META_KEY)).resolves.toBe(true);
  });

  it("konstanta versi DB konsisten", () => {
    expect(OFFLINE_DB_VERSION).toBe(1);
    expect(MAX_SYNC_ATTEMPTS).toBe(5);
  });
});

describe("classifyPushStatus", () => {
  it("menganggap status sukses backend sebagai synced", () => {
    expect(classifyPushStatus("SYNCED")).toBe("synced");
    expect(classifyPushStatus("APPLIED")).toBe("synced");
    expect(classifyPushStatus("IDEMPOTENT_SKIPPED")).toBe("synced");
  });

  it("memisahkan konflik dari kegagalan", () => {
    expect(classifyPushStatus("CONFLICT")).toBe("conflict");
    expect(classifyPushStatus("FAILED")).toBe("failed");
    expect(classifyPushStatus(undefined)).toBe("failed");
  });
});
