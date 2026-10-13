import { describe, it, expect } from "vitest";
import {
  unreadCount,
  notificationsForUser,
  applyMarkRead,
  applyMarkUnread,
  formatBadgeCount,
  type NotifiableNotification,
} from "../notification-utils";

const n = (
  id: string,
  userId: string,
  read: boolean
): NotifiableNotification => ({ id, userId, read });

const DATA: NotifiableNotification[] = [
  n("1", "u1", false),
  n("2", "u1", true),
  n("3", "u1", false),
  n("4", "u2", false),
];

describe("unreadCount", () => {
  it("counts unread for the active user only", () => {
    expect(unreadCount(DATA, "u1")).toBe(2);
    expect(unreadCount(DATA, "u2")).toBe(1);
  });

  it("returns 0 without a user", () => {
    expect(unreadCount(DATA, null)).toBe(0);
    expect(unreadCount(DATA, undefined)).toBe(0);
  });

  it("returns 0 for user with no notifications", () => {
    expect(unreadCount(DATA, "u3")).toBe(0);
  });
});

describe("notificationsForUser", () => {
  it("filters by userId", () => {
    const list = notificationsForUser(DATA, "u1");
    expect(list.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("returns empty without a user", () => {
    expect(notificationsForUser(DATA, null)).toEqual([]);
  });
});

describe("applyMarkRead / applyMarkUnread", () => {
  it("marks target as read immutably", () => {
    const out = applyMarkRead(DATA, "1");
    expect(out.find((x) => x.id === "1")?.read).toBe(true);
    expect(out.find((x) => x.id === "3")?.read).toBe(false);
    // original untouched
    expect(DATA.find((x) => x.id === "1")?.read).toBe(false);
    expect(out).not.toBe(DATA);
    expect(out[0]).not.toBe(DATA[0]);
  });

  it("marks target as unread (rollback path)", () => {
    const out = applyMarkUnread(DATA, "2");
    expect(out.find((x) => x.id === "2")?.read).toBe(false);
    expect(DATA.find((x) => x.id === "2")?.read).toBe(true);
  });

  it("is a no-op for unknown id", () => {
    expect(applyMarkRead(DATA, "nope")).toEqual(DATA);
    expect(applyMarkUnread(DATA, "nope")).toEqual(DATA);
  });

  it("mark read then unread restores original state", () => {
    const restored = applyMarkUnread(applyMarkRead(DATA, "1"), "1");
    expect(restored).toEqual(DATA);
  });
});

describe("formatBadgeCount", () => {
  it("returns null for zero or negative", () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-1)).toBeNull();
  });

  it("returns plain number up to 99", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(99)).toBe("99");
  });

  it("caps at 99+", () => {
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(1000)).toBe("99+");
  });
});
