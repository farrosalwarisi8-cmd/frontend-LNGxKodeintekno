import { describe, expect, it } from "vitest";
import { maskId } from "@/features/tte/mask";

describe("TTE — masking ID request", () => {
  it("menyamarkan ID panjang namun tetap dapat dibedakan", () => {
    const masked = maskId("9f8c1d2e-aaaa-bbbb-cccc-1234567890ab");
    expect(masked).toBe("9f8c1d2e…90ab");
    expect(masked).not.toBe("9f8c1d2e-aaaa-bbbb-cccc-1234567890ab");
  });

  it("menyamarkan ID pendek tanpa menampilkan seluruh nilai", () => {
    expect(maskId("sig-old")).toBe("si…ld");
    expect(maskId("abc")).toBe("ab…bc");
    expect(maskId("a")).toBe("a…");
  });

  it("nilai kosong tidak pernah menjadi ID palsu", () => {
    expect(maskId("")).toBe("—");
    expect(maskId("   ")).toBe("—");
    expect(maskId(null)).toBe("—");
    expect(maskId(undefined)).toBe("—");
  });

  it("request lama dan baru tetap menghasilkan string berbeda", () => {
    expect(maskId("sig-old-1111")).not.toBe(maskId("sig-new-2222"));
  });
});
