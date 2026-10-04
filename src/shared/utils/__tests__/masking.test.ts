import { describe, it, expect } from "vitest";
import { maskIdentifier, maskEmail, maskPhone, getInitials } from "../masking";

describe("maskIdentifier", () => {
  it("masks NIK correctly", () => {
    const result = maskIdentifier("3201234567890123", "NIK");
    expect(result).not.toBe("3201234567890123");
    expect(result).toContain("•");
    expect(result.length).toBe(16);
  });

  it("masks passport correctly", () => {
    const result = maskIdentifier("AB123456", "PASSPORT");
    expect(result).not.toBe("AB123456");
    expect(result).toContain("•");
  });

  it("returns empty string for empty input", () => {
    expect(maskIdentifier("", "NIK")).toBe("");
  });

  it("returns **** for very short values", () => {
    expect(maskIdentifier("12", "NIK")).toBe("****");
  });

  it("preserves first and last characters", () => {
    const value = "3201234567890123";
    const result = maskIdentifier(value, "NIK");
    expect(result[0]).toBe(value[0]);
    expect(result[result.length - 1]).toBe(value[value.length - 1]);
  });
});

describe("maskEmail", () => {
  it("masks email correctly", () => {
    const result = maskEmail("budi.santoso@kodein.co.id");
    expect(result).not.toBe("budi.santoso@kodein.co.id");
    expect(result).toContain("@kodein.co.id");
    expect(result).toContain("•••");
  });

  it("returns empty string for empty input", () => {
    expect(maskEmail("")).toBe("");
  });

  it("returns original if no @ symbol", () => {
    expect(maskEmail("notanemail")).toBe("notanemail");
  });

  it("masks short local part", () => {
    const result = maskEmail("ab@test.com");
    expect(result).toContain("@test.com");
  });
});

describe("maskPhone", () => {
  it("masks phone correctly", () => {
    const result = maskPhone("081234567890");
    expect(result).not.toBe("081234567890");
    expect(result).toContain("•••");
  });

  it("returns empty string for empty input", () => {
    expect(maskPhone("")).toBe("");
  });

  it("returns **** for very short values", () => {
    expect(maskPhone("12")).toBe("****");
  });
});

describe("getInitials", () => {
  it("returns initials from full name", () => {
    expect(getInitials("Budi Santoso")).toBe("BS");
    expect(getInitials("Siti Rahma")).toBe("SR");
  });

  it("handles single name", () => {
    expect(getInitials("Budi")).toBe("B");
  });

  it("handles multiple spaces", () => {
    expect(getInitials("Budi  Santoso")).toBe("BS");
  });

  it("returns empty for empty string", () => {
    expect(getInitials("")).toBe("");
  });
});
