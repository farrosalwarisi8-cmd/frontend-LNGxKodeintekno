import { describe, it, expect } from "vitest";
import { INITIAL_ONLINE, onlineStateFromEvent } from "../online";

describe("INITIAL_ONLINE", () => {
  it("is true so server and client render the same markup", () => {
    // Nilai awal harus konstan (true) — membaca navigator.onLine saat
    // init state menyebabkan hydration mismatch di /people & /demo.
    expect(INITIAL_ONLINE).toBe(true);
    expect(typeof INITIAL_ONLINE).toBe("boolean");
  });
});

describe("onlineStateFromEvent", () => {
  it("maps browser events to state", () => {
    expect(onlineStateFromEvent("online")).toBe(true);
    expect(onlineStateFromEvent("offline")).toBe(false);
  });
});
