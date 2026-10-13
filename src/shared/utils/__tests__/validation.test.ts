import { describe, it, expect } from "vitest";
import {
  validateFullName,
  validateIdentifier,
  validateBirthDate,
  validateSex,
  validateEmployeeNo,
  validateEmail,
  validatePhone,
  validateConsentType,
  validateConsentVersion,
} from "../validation";

describe("validateFullName", () => {
  it("accepts valid names", () => {
    expect(validateFullName("Budi Santoso").valid).toBe(true);
    expect(validateFullName("A").valid).toBe(false);
  });

  it("rejects empty names", () => {
    expect(validateFullName("").valid).toBe(false);
    expect(validateFullName("   ").valid).toBe(false);
  });

  it("rejects names shorter than 2 characters", () => {
    expect(validateFullName("A").valid).toBe(false);
  });

  it("rejects names longer than 100 characters", () => {
    expect(validateFullName("A".repeat(101)).valid).toBe(false);
  });
});

describe("validateIdentifier", () => {
  it("accepts valid NIK (16 digits)", () => {
    expect(validateIdentifier("3201234567890123", "NIK").valid).toBe(true);
  });

  it("rejects NIK with non-digits", () => {
    expect(validateIdentifier("320123456789012A", "NIK").valid).toBe(false);
  });

  it("rejects NIK with wrong length", () => {
    expect(validateIdentifier("320123456789012", "NIK").valid).toBe(false);
    expect(validateIdentifier("32012345678901234", "NIK").valid).toBe(false);
  });

  it("accepts valid passport (6-12 alphanumeric)", () => {
    expect(validateIdentifier("AB123456", "PASSPORT").valid).toBe(true);
    expect(validateIdentifier("A1B2C3D4E5F6", "PASSPORT").valid).toBe(true);
  });

  it("rejects passport with special characters", () => {
    expect(validateIdentifier("AB-123456", "PASSPORT").valid).toBe(false);
  });

  it("accepts valid KITAS (8-14 alphanumeric)", () => {
    expect(validateIdentifier("KITAS1234", "KITAS").valid).toBe(true);
  });

  it("rejects empty identifier", () => {
    expect(validateIdentifier("", "NIK").valid).toBe(false);
  });
});

describe("validateBirthDate", () => {
  it("accepts valid past dates", () => {
    expect(validateBirthDate("1990-01-15").valid).toBe(true);
  });

  it("rejects future dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const futureStr = future.toISOString().slice(0, 10);
    expect(validateBirthDate(futureStr).valid).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(validateBirthDate("not-a-date").valid).toBe(false);
  });

  it("rejects empty date", () => {
    expect(validateBirthDate("").valid).toBe(false);
  });
});

describe("validateSex", () => {
  it("accepts MALE and FEMALE", () => {
    expect(validateSex("MALE").valid).toBe(true);
    expect(validateSex("FEMALE").valid).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(validateSex("OTHER").valid).toBe(false);
    expect(validateSex("").valid).toBe(false);
  });
});

describe("validateEmployeeNo", () => {
  it("accepts non-empty employee number", () => {
    expect(validateEmployeeNo("EMP-001").valid).toBe(true);
  });

  it("rejects empty employee number", () => {
    expect(validateEmployeeNo("").valid).toBe(false);
    expect(validateEmployeeNo("   ").valid).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts valid email", () => {
    expect(validateEmail("nama@perusahaan.com").valid).toBe(true);
    expect(validateEmail("test@example.co.id").valid).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(validateEmail("not-an-email").valid).toBe(false);
    expect(validateEmail("missing@domain").valid).toBe(false);
    expect(validateEmail("@nodomain.com").valid).toBe(false);
  });

  it("rejects empty email", () => {
    expect(validateEmail("").valid).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts valid phone numbers", () => {
    expect(validatePhone("081234567890").valid).toBe(true);
    expect(validatePhone("+6281234567890").valid).toBe(true);
  });

  it("accepts empty phone (optional field)", () => {
    expect(validatePhone("").valid).toBe(true);
  });

  it("rejects invalid phone format", () => {
    expect(validatePhone("abc").valid).toBe(false);
    expect(validatePhone("123").valid).toBe(false);
  });
});

describe("validateConsentType", () => {
  it("accepts non-empty consent type", () => {
    expect(validateConsentType("EMR_DATA_PROCESSING").valid).toBe(true);
  });

  it("rejects empty consent type", () => {
    expect(validateConsentType("").valid).toBe(false);
  });
});

describe("validateConsentVersion", () => {
  it("accepts non-empty version", () => {
    expect(validateConsentVersion("1.0").valid).toBe(true);
  });

  it("rejects empty version", () => {
    expect(validateConsentVersion("").valid).toBe(false);
  });
});
