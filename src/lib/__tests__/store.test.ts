import { describe, it, expect, beforeEach } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "document", {
  value: { cookie: "" },
});

import { useStore } from "../../../lib/store";
import type { AppNotification, User } from "../../../lib/types";

/**
 * Data uji LOKAL — test tidak boleh bergantung pada seed global store.
 * Pada production/staging (dan test runner) `NEXT_PUBLIC_ENABLE_DEMO=false`,
 * sehingga state awal store memang kosong.
 */
const TEST_USER: User = {
  id: "u1",
  username: "admin",
  password: "",
  name: "Admin Test",
  role: "admin",
  title: "System Administrator",
  mfaEnabled: false,
  preferredLanguage: "id",
};

const TEST_NOTIFICATIONS: AppNotification[] = [
  { id: "n-test-1", userId: "u1", title: "Notifikasi 1", message: "Pesan 1", read: false, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "n-test-2", userId: "u1", title: "Notifikasi 2", message: "Pesan 2", read: false, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("store initial state", () => {
  it("tidak memuat data klinis seed saat demo mode nonaktif", () => {
    const initial = useStore.getInitialState();
    expect(initial.employees).toEqual([]);
    expect(initial.visits).toEqual([]);
    expect(initial.mcus).toEqual([]);
    expect(initial.users).toEqual([]);
    expect(initial.notifications).toEqual([]);
    expect(initial.auditLogs).toEqual([]);
  });
});

describe("store auth state", () => {
  beforeEach(() => {
    useStore.setState({
      users: [TEST_USER],
      notifications: TEST_NOTIFICATIONS,
      currentUserId: null,
      session: null,
    });
  });

  it("starts unauthenticated", () => {
    const state = useStore.getState();
    expect(state.currentUserId).toBeNull();
    expect(state.session).toBeNull();
  });

  it("returns user after setting currentUserId", () => {
    useStore.setState({ currentUserId: "u1" });
    const state = useStore.getState();
    const user = state.users.find((u) => u.id === state.currentUserId);
    expect(user).not.toBeNull();
    expect(user?.id).toBe("u1");
  });

  it("returns role from current user", () => {
    useStore.setState({ currentUserId: "u1" });
    const state = useStore.getState();
    const user = state.users.find((u) => u.id === state.currentUserId);
    expect(user?.role).toBe("admin");
  });

  it("logout clears session", () => {
    useStore.setState({
      currentUserId: "u1",
      session: { userId: "u1", loginAt: "2024-01-01", lastActivity: "2024-01-01", mfaVerified: true },
    });

    const logout = useStore.getState().logout;
    logout();

    expect(useStore.getState().currentUserId).toBeNull();
    expect(useStore.getState().session).toBeNull();
  });
});

describe("store notification state", () => {
  beforeEach(() => {
    useStore.setState({ notifications: TEST_NOTIFICATIONS });
  });

  it("markNotificationRead updates notification", () => {
    const store = useStore.getState();
    const notifications = store.notifications;
    expect(notifications.length).toBeGreaterThan(0);
    const target = notifications[0];
    store.markNotificationRead(target.id);
    const updated = useStore.getState().notifications.find((n: AppNotification) => n.id === target.id);
    expect(updated?.read).toBe(true);
  });

  it("markAllNotificationsRead marks all as read", () => {
    const store = useStore.getState();
    store.markAllNotificationsRead();
    const allRead = useStore.getState().notifications.every((n: AppNotification) => n.read);
    expect(allRead).toBe(true);
  });
});

describe("store scope state", () => {
  it("setOrgScope updates scope", () => {
    const store = useStore.getState();
    store.setOrgScope({ companyId: "cmp1", locationId: "loc1" });
    expect(useStore.getState().orgScope).toEqual({ companyId: "cmp1", locationId: "loc1" });
  });
});
