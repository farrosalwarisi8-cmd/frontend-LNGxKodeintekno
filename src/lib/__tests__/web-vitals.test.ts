import { describe, it, expect } from "vitest";
import { rateMetric, VITAL_TARGETS } from "../web-vitals";

describe("rateMetric", () => {
  it("mengklasifikasikan LCP", () => {
    expect(rateMetric("LCP", 1000)).toBe("good");
    expect(rateMetric("LCP", 2500)).toBe("good");
    expect(rateMetric("LCP", 3000)).toBe("needs-improvement");
    expect(rateMetric("LCP", 4000)).toBe("needs-improvement");
    expect(rateMetric("LCP", 5000)).toBe("poor");
  });

  it("mengklasifikasikan INP", () => {
    expect(rateMetric("INP", 100)).toBe("good");
    expect(rateMetric("INP", 200)).toBe("good");
    expect(rateMetric("INP", 300)).toBe("needs-improvement");
    expect(rateMetric("INP", 500)).toBe("needs-improvement");
    expect(rateMetric("INP", 600)).toBe("poor");
  });

  it("mengklasifikasikan CLS", () => {
    expect(rateMetric("CLS", 0.05)).toBe("good");
    expect(rateMetric("CLS", 0.1)).toBe("good");
    expect(rateMetric("CLS", 0.15)).toBe("needs-improvement");
    expect(rateMetric("CLS", 0.25)).toBe("needs-improvement");
    expect(rateMetric("CLS", 0.3)).toBe("poor");
  });
});

describe("VITAL_TARGETS", () => {
  it("memiliki target standar Core Web Vitals", () => {
    expect(VITAL_TARGETS.LCP).toBe(2500);
    expect(VITAL_TARGETS.INP).toBe(200);
    expect(VITAL_TARGETS.CLS).toBe(0.1);
  });
});
