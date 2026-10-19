import { describe, expect, it } from "vitest";
import {
  REMINDER_STAGES,
  daysUntil,
  reminderState,
  reminderStatus,
  reminderSummary,
  reminderTimeline,
} from "../mcu-reminder";

/** Tanggal acuan: 20 Oktober 2026 (lokal). */
const NOW = new Date(2026, 9, 20);

function daysFromNow(days: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe("daysUntil()", () => {
  it("menghitung sisa hari per hari kalender", () => {
    expect(daysUntil(daysFromNow(0), NOW)).toBe(0);
    expect(daysUntil(daysFromNow(1), NOW)).toBe(1);
    expect(daysUntil(daysFromNow(30), NOW)).toBe(30);
    expect(daysUntil(daysFromNow(-5), NOW)).toBe(-5);
  });

  it("mengembalikan null untuk tanggal kosong/tidak valid", () => {
    expect(daysUntil(undefined, NOW)).toBeNull();
    expect(daysUntil("", NOW)).toBeNull();
    expect(daysUntil("bukan-tanggal", NOW)).toBeNull();
  });

  it("menerima timestamp ISO dari backend", () => {
    expect(daysUntil("2026-10-25T00:00:00.000Z", NOW)).toBe(5);
  });
});

describe("reminderStatus() — tahapan H-30 / H-14 / H-7 / Hari-H / Overdue", () => {
  it("H-30 untuk sisa waktu 30..15 hari", () => {
    expect(reminderStatus(daysFromNow(30), NOW)).toBe("H-30");
    expect(reminderStatus(daysFromNow(15), NOW)).toBe("H-30");
  });

  it("H-14 untuk sisa waktu 14..8 hari", () => {
    expect(reminderStatus(daysFromNow(14), NOW)).toBe("H-14");
    expect(reminderStatus(daysFromNow(8), NOW)).toBe("H-14");
  });

  it("H-7 untuk sisa waktu 7..1 hari", () => {
    expect(reminderStatus(daysFromNow(7), NOW)).toBe("H-7");
    expect(reminderStatus(daysFromNow(1), NOW)).toBe("H-7");
  });

  it("HARI-H untuk hari yang sama", () => {
    expect(reminderStatus(daysFromNow(0), NOW)).toBe("HARI-H");
  });

  it("OVERDUE bila tanggal sudah lewat", () => {
    expect(reminderStatus(daysFromNow(-1), NOW)).toBe("OVERDUE");
    expect(reminderStatus(daysFromNow(-30), NOW)).toBe("OVERDUE");
  });

  it("AKTIF bila masih di luar jadwal reminder (>30 hari)", () => {
    expect(reminderStatus(daysFromNow(31), NOW)).toBe("AKTIF");
    expect(reminderStatus(daysFromNow(365), NOW)).toBe("AKTIF");
  });

  it("TIDAK_DIKETAHUI bila tidak ada tanggal berakhir", () => {
    expect(reminderStatus(undefined, NOW)).toBe("TIDAK_DIKETAHUI");
    expect(reminderStatus("invalid", NOW)).toBe("TIDAK_DIKETAHUI");
  });
});

describe("reminderState()", () => {
  it("selalu menyertakan label teks + ikon (bukan hanya warna)", () => {
    for (const status of ["H-30", "H-14", "H-7", "HARI-H", "OVERDUE", "AKTIF"] as const) {
      const days = status === "AKTIF" ? 60 : 10;
      const state = reminderState(daysFromNow(days), NOW);
      expect(state.label.length, status).toBeGreaterThan(0);
      expect(state.description.length, status).toBeGreaterThan(0);
      expect(state.icon.length, status).toBeGreaterThan(0);
      expect(state.tone.length, status).toBeGreaterThan(0);
    }
  });

  it("menyisakan sisa hari yang benar", () => {
    expect(reminderState(daysFromNow(12), NOW).daysRemaining).toBe(12);
    expect(reminderState(daysFromNow(-3), NOW).daysRemaining).toBe(-3);
  });
});

describe("reminderTimeline()", () => {
  it("menghasilkan lima tahapan dalam urutan yang benar", () => {
    const timeline = reminderTimeline(daysFromNow(12), NOW);
    expect(timeline.map((t) => t.stage)).toEqual([...REMINDER_STAGES]);
  });

  it("menandai tahap yang sudah tercapai dan tahap saat ini", () => {
    const timeline = reminderTimeline(daysFromNow(12), NOW);
    const byStage = Object.fromEntries(timeline.map((t) => [t.stage, t]));
    expect(byStage["H-30"].reached).toBe(true);
    expect(byStage["H-30"].current).toBe(false);
    expect(byStage["H-14"].reached).toBe(true);
    expect(byStage["H-14"].current).toBe(true);
    expect(byStage["H-7"].reached).toBe(false);
    expect(byStage["H-7"].current).toBe(false);
    expect(byStage["HARI-H"].reached).toBe(false);
    expect(byStage["OVERDUE"].reached).toBe(false);
  });

  it("status overdue menandai seluruh tahap sebagai tercapai", () => {
    const timeline = reminderTimeline(daysFromNow(-2), NOW);
    expect(timeline.every((t) => t.reached)).toBe(true);
    expect(timeline.find((t) => t.current)?.stage).toBe("OVERDUE");
  });

  it("status Hari-H menandai tahap HARI-H sebagai saat ini", () => {
    const timeline = reminderTimeline(daysFromNow(0), NOW);
    expect(timeline.find((t) => t.current)?.stage).toBe("HARI-H");
  });

  it("tanpa tanggal → tidak ada tahap yang tercapai", () => {
    const timeline = reminderTimeline(undefined, NOW);
    expect(timeline.every((t) => !t.reached)).toBe(true);
    expect(timeline.some((t) => t.current)).toBe(false);
  });
});

describe("reminderSummary()", () => {
  it("menyebutkan tahap dan sisa hari dalam teks", () => {
    expect(reminderSummary(reminderState(daysFromNow(12), NOW))).toBe("H-14 · 12 hari lagi");
    expect(reminderSummary(reminderState(daysFromNow(0), NOW))).toBe("Hari-H · hari ini");
    expect(reminderSummary(reminderState(daysFromNow(-3), NOW))).toBe("Overdue · telat 3 hari");
    expect(reminderSummary(reminderState(undefined, NOW))).toBe("Tanpa Tanggal");
  });
});
