import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, formatRelativeTime, isExpired, addDays, toISODate } from "../date";

describe("formatDate", () => {
  it("formats ISO date correctly", () => {
    const result = formatDate("2026-10-03T10:00:00Z");
    expect(result).toContain("2026");
    expect(result).not.toBe("—");
  });

  it("returns — for undefined input", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("returns — for invalid date", () => {
    expect(formatDate("invalid")).toBe("invalid");
  });
});

describe("formatDateTime", () => {
  it("formats ISO datetime correctly", () => {
    const result = formatDateTime("2026-10-03T10:30:00Z");
    expect(result).toContain("2026");
    expect(result).not.toBe("—");
  });

  it("returns — for undefined input", () => {
    expect(formatDateTime(undefined)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'Baru saja' for current time", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("Baru saja");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 menit lalu");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe("2 jam lalu");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe("3 hari lalu");
  });

  it("returns — for undefined input", () => {
    expect(formatRelativeTime(undefined)).toBe("—");
  });
});

describe("isExpired", () => {
  it("returns true for past dates", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(past)).toBe(true);
  });

  it("returns false for future dates", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});

describe("addDays", () => {
  it("adds days correctly", () => {
    const date = new Date("2026-10-01");
    const result = addDays(date, 5);
    expect(result.getDate()).toBe(6);
  });

  it("handles month boundaries", () => {
    const date = new Date("2026-10-30T00:00:00");
    const result = addDays(date, 5);
    expect(result.getMonth()).toBe(10); // November (0-indexed)
  });
});

describe("toISODate", () => {
  it("converts Date to ISO date string", () => {
    const date = new Date("2026-10-03T10:00:00Z");
    const result = toISODate(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
