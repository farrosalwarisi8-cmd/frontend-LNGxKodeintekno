import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueOfflineQueue,
  isAckOnly,
  loadOfflineQueue,
  MAX_OFFLINE_RETRIES,
  removeOfflineQueue,
  saveOfflineQueue,
  clearOfflineQueue,
} from "../offline-queue";

const storage = new Map<string, string>();

beforeEach(() => {
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

describe("offline-queue", () => {
  it("menyimpan dan memuat antrean ke localStorage", () => {
    const entries = enqueueOfflineQueue([], {
      action: "addEmployee",
      args: [{ fullName: "Budi" }],
    });
    saveOfflineQueue(entries);
    const loaded = loadOfflineQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].action).toBe("addEmployee");
    expect(loaded[0].args).toEqual([{ fullName: "Budi" }]);
    expect(loaded[0].retries).toBe(0);
    expect(typeof loaded[0].id).toBe("string");
    expect(typeof loaded[0].attemptedAt).toBe("string");
  });

  it("tidak crash bila localStorage kosong/berisi search params", () => {
    expect(loadOfflineQueue()).toEqual([]);
  });

  it("menghapus entri berdasarkan id", () => {
    const entries = enqueueOfflineQueue([], {
      action: "registerVisit",
      args: [{ employeeId: "e1" }],
    });
    saveOfflineQueue(entries);
    const after = removeOfflineQueue(loadOfflineQueue(), entries[0].id);
    expect(after).toHaveLength(0);
  });

  it("mengosongkan antrean", () => {
    saveOfflineQueue(
      enqueueOfflineQueue([], { action: "addEmployee", args: [] })
    );
    expect(clearOfflineQueue()).toHaveLength(0);
  });

  it("MAX_OFFLINE_RETRIES = 3", () => {
    expect(MAX_OFFLINE_RETRIES).toBe(3);
  });

  it("isAckOnly membedakan aksi buat dan aksi perbarui", () => {
    expect(isAckOnly("addEmployee")).toBe(true);
    expect(isAckOnly("registerVisit")).toBe(true);
    expect(isAckOnly("dispense")).toBe(true);
    expect(isAckOnly("submitMCU")).toBe(true);
    expect(isAckOnly("updateEmployee")).toBe(false);
    expect(isAckOnly("updateVisit")).toBe(false);
  });
});
