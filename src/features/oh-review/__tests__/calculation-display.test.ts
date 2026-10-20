import { describe, expect, it } from "vitest";
import {
  hasWorsening,
  hasWorseningMarker,
  humanizeFieldKey,
  metricLabel,
  readWorseningFlag,
  toCalculationRows,
} from "@/features/oh-review/calculation-display";
import { toReviewCycle } from "@/features/oh-review/review-cycle";

/**
 * A3 — Pemetaan nilai terhitung dari server.
 *
 * Test ini mengunci dua hal:
 *  1. Nilai ditampilkan APA ADANYA (tidak dibulatkan, tidak dihitung ulang).
 *  2. Penanda perburukan hanya berasal dari flag eksplisit API.
 */

describe("A3 — label metrik", () => {
  it("memetakan key API yang dikenal ke label yang jelas", () => {
    expect(metricLabel("bmi")).toContain("BMI");
    expect(metricLabel("systolic_bp")).toContain("sistolik");
    expect(metricLabel("audiometry")).toContain("Audiometri");
    expect(metricLabel("spirometry")).toContain("Spirometri");
    expect(metricLabel("cv_score")).toContain("kardiovaskular");
  });

  it("key tak dikenal tetap ditampilkan apa adanya (humanize)", () => {
    expect(metricLabel("audio_sts_left")).toBe("Audio Sts Left");
    expect(humanizeFieldKey("cardiovascular-risk")).toBe("Cardiovascular Risk");
  });
});

describe("A3 — baris nilai dari calculations API", () => {
  it("menampilkan nilai & satuan apa adanya", () => {
    const rows = toCalculationRows([
      { name: "bmi", value: 24.53, unit: "kg/m2" },
      { name: "systolic_bp", value: 128, unit: "mmHg" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: "BMI (Indeks Massa Tubuh)", value: "24.53", unit: "kg/m2" });
    expect(rows[1]).toMatchObject({ label: "Tekanan darah sistolik", value: "128", unit: "mmHg" });
  });

  it("membaca entri dengan beberapa field skalar", () => {
    const rows = toCalculationRows([{ systolic: 120, diastolic: 80, unit: "mmHg" }]);
    expect(rows.map((row) => row.value)).toEqual(["120", "80"]);
    expect(rows.every((row) => row.unit === "mmHg")).toBe(true);
  });

  it("mengabaikan entri yang bukan objek atau tidak punya nilai", () => {
    expect(toCalculationRows([null, "teks", 42, {}])).toEqual([]);
    expect(toCalculationRows(undefined)).toEqual([]);
  });

  it("tidak pernah menghitung ulang atau membulatkan nilai", () => {
    const rows = toCalculationRows([{ name: "bmi", value: 24.531 }]);
    expect(rows[0].value).toBe("24.531");
  });
});

describe("A3 — penanda perburukan hanya dari flag API", () => {
  it("membaca flag boolean eksplisit", () => {
    expect(readWorseningFlag({ worsening: true })).toBe(true);
    expect(readWorseningFlag({ is_worsening: false })).toBe(false);
    expect(readWorseningFlag({})).toBeNull();
    expect(readWorseningFlag({ worsening: "ya" })).toBeNull();
  });

  it("menandai baris yang worsened dan tidak menandai bila flag absen", () => {
    const rows = toCalculationRows([
      { name: "audiometry", value: 25, worsening: true },
      { name: "spirometry", value: 90 },
    ]);
    expect(rows[0].worsening).toBe(true);
    expect(rows[1].worsening).toBeNull();
    expect(hasWorseningMarker(rows)).toBe(true);
    expect(hasWorsening(rows)).toBe(true);
  });

  it("tidak menganggap nilai non-boolean sebagai penanda", () => {
    const rows = toCalculationRows([{ name: "bmi", value: 22, abnormal_flag: true }]);
    expect(rows[0].worsening).toBeNull();
    expect(hasWorseningMarker(rows)).toBe(false);
  });
});

describe("A3 — view model siklus", () => {
  it("menandai perburukan dari calculations API", () => {
    const cycle = toReviewCycle({
      id: "cycle-1",
      patient_id: "patient-1",
      mcu_type: "ANNUAL_PERIODIC",
      examination_date: "2026-10-01",
      calculations: [{ name: "audiometry", value: 30, worsening: true }],
    });
    expect(cycle.worsening).toBe(true);
    expect(cycle.worseningAvailable).toBe(true);
  });

  it("menandai siklus tanpa flag perburukan sebagai 'tidak tersedia'", () => {
    const cycle = toReviewCycle({
      id: "cycle-1",
      patient_id: "patient-1",
      mcu_type: "ANNUAL_PERIODIC",
      examination_date: "2026-10-01",
      calculations: [{ name: "bmi", value: 22 }],
    });
    expect(cycle.worsening).toBe(false);
    expect(cycle.worseningAvailable).toBe(false);
  });

  it("tidak mengarang saran FTW bila API tidak mengirimnya", () => {
    const cycle = toReviewCycle({
      id: "cycle-1",
      patient_id: "patient-1",
      mcu_type: "ANNUAL_PERIODIC",
      examination_date: "2026-10-01",
    });
    expect(cycle.suggestedFtw).toBeNull();
    expect(cycle.hasDecision).toBe(false);
  });
});
