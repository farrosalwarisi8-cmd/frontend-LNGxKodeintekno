import { describe, expect, it } from "vitest";
import {
  FTW_CATEGORIES,
  deviationReasonHint,
  ftwLabel,
  isFtwCategory,
  readSuggestedFtw,
  requiresDeviationReason,
  validateFtwForm,
  type FtwCategory,
} from "@/features/oh-review/ftw";

/**
 * A3 — Logika penetapan FTW.
 *
 * Fokus test: "alasan deviasi wajib diisi bila pilihan dokter berbeda dari
 * saran sistem". Saran sistem HANYA boleh dipakai bila API mengirimkannya.
 */

describe("A3 — kategori FTW", () => {
  it("memiliki tepat empat kategori sesuai proposal", () => {
    expect(FTW_CATEGORIES.map((option) => option.value)).toEqual([
      "FIT",
      "FIT_WITH_RESTRICTION",
      "TEMPORARILY_UNFIT",
      "UNFIT",
    ]);
  });

  it("mengenal kategori yang valid dan menolak nilai lain", () => {
    expect(isFtwCategory("FIT")).toBe(true);
    expect(isFtwCategory("UNFIT")).toBe(true);
    expect(isFtwCategory("SEHAT")).toBe(false);
    expect(isFtwCategory(undefined)).toBe(false);
  });

  it("label FTW dari API ditampilkan apa adanya bila tak dikenal", () => {
    expect(ftwLabel("FIT")).toBe("Fit");
    expect(ftwLabel("UNFIT")).toBe("Unfit");
    expect(ftwLabel(null)).toBe("Belum ada keputusan");
    expect(ftwLabel("STATUS_BARU")).toBe("STATUS_BARU");
  });
});

describe("A3 — saran sistem hanya dibaca dari API", () => {
  it("membaca saran bila API mengirimkannya", () => {
    expect(readSuggestedFtw({ suggested_ftw_status: "FIT" })).toBe("FIT");
    expect(readSuggestedFtw({ ftwSuggestion: "TEMPORARILY_UNFIT" })).toBe("TEMPORARILY_UNFIT");
  });

  it("mengembalikan null bila API tidak mengirim saran (tidak ditebak)", () => {
    expect(readSuggestedFtw({})).toBeNull();
    expect(readSuggestedFtw({ ftw_status: "FIT" })).toBeNull();
    expect(readSuggestedFtw({ suggested_ftw_status: "NGGAK_VALID" })).toBeNull();
    expect(readSuggestedFtw(null)).toBeNull();
  });
});

describe("A3 — alasan deviasi wajib bila berbeda dari saran sistem", () => {
  it("wajib bila pilihan berbeda dari saran", () => {
    expect(requiresDeviationReason("FIT", "UNFIT")).toBe(true);
    expect(requiresDeviationReason("FIT_WITH_RESTRICTION", "FIT")).toBe(true);
  });

  it("tidak wajib bila pilihan sama dengan saran", () => {
    expect(requiresDeviationReason("FIT", "FIT")).toBe(false);
  });

  it("tidak wajib bila tidak ada saran sistem maupun pilihan", () => {
    expect(requiresDeviationReason(null, "FIT")).toBe(false);
    expect(requiresDeviationReason("FIT", null)).toBe(false);
    expect(requiresDeviationReason(null, null)).toBe(false);
  });
});

describe("A3 — validasi form penetapan FTW", () => {
  const base = {
    chosen: "FIT" as FtwCategory,
    suggested: null,
    reason: "",
  };

  it("menolak form tanpa kategori FTW", () => {
    const result = validateFtwForm({ ...base, chosen: null });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Pilih kategori FTW");
  });

  it("menolak deviasi tanpa alasan", () => {
    const result = validateFtwForm({ ...base, suggested: "FIT", chosen: "UNFIT", reason: "   " });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Alasan deviasi");
  });

  it("menerima deviasi dengan alasan", () => {
    const result = validateFtwForm({
      ...base,
      suggested: "FIT",
      chosen: "UNFIT",
      reason: "Kondisi klinis tidak sesuai untuk duties offshore",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("tidak mewajibkan alasan bila tidak ada saran sistem", () => {
    const result = validateFtwForm({ ...base, reason: "" });
    expect(result.valid).toBe(true);
  });

  it("wajib deskripsi & tanggal review untuk Fit with Restriction", () => {
    const result = validateFtwForm({
      ...base,
      chosen: "FIT_WITH_RESTRICTION",
      restrictionDescription: "",
      restrictionReviewDate: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Deskripsi pembatasan");
    expect(result.errors.join(" ")).toContain("Tanggal review");
  });

  it("menerima Fit with Restriction yang lengkap", () => {
    const result = validateFtwForm({
      ...base,
      chosen: "FIT_WITH_RESTRICTION",
      restrictionDescription: "Dilarang bekerja di ketinggian > 2 meter",
      restrictionReviewDate: "2027-01-04",
    });
    expect(result.valid).toBe(true);
  });
});

describe("A3 — keterangan deviasi", () => {
  it("menjelaskan bahwa saran sistem tidak tersedia", () => {
    expect(deviationReasonHint(null, "FIT")).toContain("Saran sistem tidak tersedia");
  });

  it("menyebutkan perbedaan pilihan terhadap saran sistem", () => {
    const hint = deviationReasonHint("FIT", "UNFIT");
    expect(hint).toContain("berbeda dari saran sistem");
    expect(hint).toContain("wajib diisi");
  });

  it("menjelaskan saat pilihan sama dengan saran sistem", () => {
    expect(deviationReasonHint("FIT", "FIT")).toContain("sama dengan saran sistem");
  });
});
