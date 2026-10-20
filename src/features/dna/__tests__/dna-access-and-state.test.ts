import { describe, expect, it } from "vitest";
import { decideDnaAccess, REVEAL_PROMPT, requiresExplicitReveal } from "@/features/dna/access";
import {
  clearDnaSensitiveState,
  getDnaSensitiveState,
  hasDnaSensitiveState,
  setDnaSensitiveState,
} from "@/features/dna/sensitive-state";
import {
  confirmationResultLabel,
  hasConfirmationResult,
  isConfirmed,
  requiresConfirmationTest,
  screeningResultLabel,
} from "@/features/dna/results";
import { custodyActionLabel, toCustodyTimeline } from "@/features/dna/custody";
import type { BackendDaTest } from "@/lib/services/da.service";

/**
 * A3 — Aturan akses D&A, pembersihan state sensitif, dan aturan hasil.
 */

describe("A3 — akses modul D&A dibatasi", () => {
  it("Dokter OH boleh membuka modul D&A", () => {
    const decision = decideDnaAccess("dokter-oh");
    expect(decision.allowed).toBe(true);
    expect(decision.reason).toBe("allowed");
  });

  it("role lain ditolak", () => {
    for (const role of ["admin", "admin-klinik", "hr", "lab", "apoteker", "manajemen", "perawat", "dokter-klinik", "pekerja"] as const) {
      const decision = decideDnaAccess(role);
      expect(decision.allowed, `${role} tidak boleh`).toBe(false);
      expect(decision.reason).toBe("no-permission");
    }
  });

  it("HSE ditolak selama belum ada penunjukan dari server", () => {
    const decision = decideDnaAccess("hse");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("not-designated");
    expect(decision.message).toContain("penunjukan");
  });

  it("HSE tetap ditolak walau penruzonasi di klien", () => {
    // Penunjukan harus berasal dari server; HSE juga belum punya permission
    // `view-dna`, jadi akses tetap ditolak.
    const decision = decideDnaAccess("hse", true);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("no-permission");
  });

  it("sesi kosong ditolak", () => {
    expect(decideDnaAccess(null).allowed).toBe(false);
  });
});

describe("A3 — hasil D&A tersembunyi secara default", () => {
  it("wajib dibuka secara sadar", () => {
    expect(requiresExplicitReveal()).toBe(true);
  });

  it("teks ajakan menjelaskan pencatatan audit server", () => {
    expect(REVEAL_PROMPT).toContain("disembunyikan");
    expect(REVEAL_PROMPT).toContain("audit log");
  });
});

describe("A3 — pembersihan state sensitif", () => {
  it("menyimpan, membaca, lalu membersihkan data D&A", () => {
    setDnaSensitiveState({
      tests: [
        {
          id: "da-1",
          patient: { id: "patient-1", full_name: "Budi Santoso" },
          results: [{ id: "res-1", da_test_id: "da-1", screening_result: "NON_NEGATIVE" }],
        } as BackendDaTest,
      ],
      selectedTestId: "da-1",
      resultsRevealed: true,
    });
    expect(hasDnaSensitiveState()).toBe(true);
    expect(getDnaSensitiveState().selectedTestId).toBe("da-1");

    clearDnaSensitiveState();
    expect(hasDnaSensitiveState()).toBe(false);
    expect(getDnaSensitiveState().tests).toEqual([]);
    expect(getDnaSensitiveState().selectedTestId).toBeNull();
    expect(getDnaSensitiveState().resultsRevealed).toBe(false);
  });
});

describe("A3 — confirmation test ditentukan oleh data API", () => {
  const base = { id: "da-1" } as BackendDaTest;

  it("wajib saat status API = CONFIRMATION_PENDING", () => {
    expect(requiresConfirmationTest({ ...base, status: "CONFIRMATION_PENDING" })).toBe(true);
  });

  it("wajib saat screening API = NON_NEGATIVE", () => {
    expect(
      requiresConfirmationTest({
        ...base,
        status: "SAMPLE_COLLECTED",
        results: [{ id: "r", da_test_id: "da-1", screening_result: "NON_NEGATIVE" }],
      })
    ).toBe(true);
  });

  it("tidak wajib saat screening negatif tanpa status pending", () => {
    expect(
      requiresConfirmationTest({
        ...base,
        status: "SAMPLE_COLLECTED",
        results: [{ id: "r", da_test_id: "da-1", screening_result: "NEGATIVE" }],
      })
    ).toBe(false);
  });

  it("label hasil mengikuti nilai API (tidak menafsirkan)", () => {
    expect(screeningResultLabel("NON_NEGATIVE")).toBe("NON_NEGATIVE");
    expect(screeningResultLabel(undefined)).toBe("Belum ada hasil screening");
    expect(
      confirmationResultLabel({
        id: "r",
        da_test_id: "da-1",
        screening_result: "NON_NEGATIVE",
        confirmation_result: "NEGATIVE",
      })
    ).toBe("NEGATIVE");
    expect(hasConfirmationResult({ id: "r", da_test_id: "da-1" })).toBe(false);
    expect(isConfirmed({ id: "r", da_test_id: "da-1", confirmed: true })).toBe(true);
  });
});

describe("A3 — chain of custody hanya-tambah", () => {
  it("memetakan aksi API ke label", () => {
    expect(custodyActionLabel("SAMPLE_COLLECTED_AND_SEALED")).toContain("disegel");
    expect(custodyActionLabel("RECEIVED_BY_LAB")).toContain("laboratorium");
  });

  it("aksi tak dikenal ditampilkan apa adanya", () => {
    expect(custodyActionLabel("AKSI_BARU")).toBe("AKSI_BARU");
    expect(custodyActionLabel(null)).toBe("Aksi tidak tersedia dari API");
  });

  it("menyusun lini waktu dengan pelaku, waktu, dan keterangan", () => {
    const timeline = toCustodyTimeline([
      {
        id: "custody-1",
        sample_id: "sample-1",
        from_party: "Officer Rudi",
        to_party: "Laboratorium",
        action: "HANDED_TO_COURIER",
        signature_hash: "abcdef123456",
        event_at: "2026-10-01T08:00:00.000Z",
      },
    ]);
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      actionLabel: "Diserahkan ke kurir",
      fromParty: "Officer Rudi",
      toParty: "Laboratorium",
      eventAt: "2026-10-01T08:00:00.000Z",
    });
  });

  it("timeline kosong tidak dikarang", () => {
    expect(toCustodyTimeline([])).toEqual([]);
    expect(toCustodyTimeline(undefined)).toEqual([]);
  });
});
