import { describe, it, expect } from "vitest";
import {
  VITAL_SPECS,
  assessVitals,
  validateVital,
  vitalFieldError,
  vitalWarningCount,
  type VitalField,
} from "../vital-signs";

describe("validateVital", () => {
  it("treats blank input as empty without a message", () => {
    const result = validateVital("systolicBp", "");
    expect(result.empty).toBe(true);
    expect(result.severity).toBe("ok");
    expect(result.message).toBeUndefined();
  });

  it("rejects non-numeric input as critical", () => {
    const result = validateVital("pulse", "cepat");
    expect(result.severity).toBe("critical");
    expect(result.message).toContain("harus berupa angka");
  });

  it("flags values outside the physiological range as critical", () => {
    const high = validateVital("systolicBp", "900");
    expect(high.severity).toBe("critical");
    expect(high.value).toBe(900);
    expect(high.message).toContain("di luar rentang wajar");

    const low = validateVital("temperature", "12");
    expect(low.severity).toBe("critical");
  });

  it("warns (without blocking) on clinically notable values", () => {
    const fever = validateVital("temperature", "38.5");
    expect(fever.severity).toBe("warning");
    expect(fever.message).toContain("Suhu");

    const tachy = validateVital("pulse", "135");
    expect(tachy.severity).toBe("warning");

    const lowSpo2 = validateVital("spo2", "90");
    expect(lowSpo2.severity).toBe("warning");
  });

  it("accepts normal values", () => {
    expect(validateVital("systolicBp", "120").severity).toBe("ok");
    expect(validateVital("diastolicBp", "80").severity).toBe("ok");
    expect(validateVital("pulse", "78").severity).toBe("ok");
    expect(validateVital("spo2", "98").severity).toBe("ok");
  });

  it("accepts a comma as the decimal separator", () => {
    const result = validateVital("temperature", "37,2");
    expect(result.severity).toBe("ok");
    expect(result.value).toBe(37.2);
  });

  it("accepts the boundary values of the hard range", () => {
    expect(validateVital("systolicBp", String(VITAL_SPECS.systolicBp.hardMin)).severity).not.toBe(
      "critical"
    );
    expect(validateVital("systolicBp", String(VITAL_SPECS.systolicBp.hardMax)).severity).not.toBe(
      "critical"
    );
  });
});

describe("assessVitals", () => {
  const normal: Partial<Record<VitalField, string>> = {
    systolicBp: "120",
    diastolicBp: "80",
    pulse: "80",
    temperature: "36.8",
    weightKg: "70",
    heightCm: "172",
  };

  it("allows proceeding when every value is plausible", () => {
    const summary = assessVitals(normal, ["systolicBp", "diastolicBp", "pulse"]);
    expect(summary.canProceed).toBe(true);
    expect(summary.severity).toBe("ok");
    expect(summary.messages).toEqual([]);
  });

  it("does not block on warnings but reports them", () => {
    const summary = assessVitals({ ...normal, temperature: "38.5" }, ["temperature"]);
    expect(summary.canProceed).toBe(true);
    expect(summary.severity).toBe("warning");
    expect(vitalWarningCount(summary)).toBe(1);
    expect(summary.messages).toHaveLength(1);
  });

  it("blocks submission when a required field is empty", () => {
    const summary = assessVitals({ systolicBp: "", diastolicBp: "80" }, [
      "systolicBp",
      "diastolicBp",
    ]);
    expect(summary.canProceed).toBe(false);
    expect(summary.severity).toBe("critical");
    expect(summary.byField.systolicBp?.message).toContain("wajib diisi");
  });

  it("blocks submission when a value is outside the plausible range", () => {
    const summary = assessVitals({ ...normal, pulse: "500" }, ["pulse"]);
    expect(summary.canProceed).toBe(false);
    expect(vitalFieldError(summary.byField.pulse)).toBeDefined();
  });

  it("ignores fields that are not present in the form", () => {
    const summary = assessVitals({ pulse: "80" });
    expect(Object.keys(summary.byField)).toEqual(["pulse"]);
  });
});
