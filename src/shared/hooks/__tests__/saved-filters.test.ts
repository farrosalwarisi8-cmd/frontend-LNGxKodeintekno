import { describe, it, expect } from "vitest";
import {
  FILTER_PRESETS,
  parseStoredFilters,
  presetFromQuery,
  serializeFilters,
  storageKey,
} from "../use-saved-filters";

describe("parseStoredFilters", () => {
  it("reads a stored filter object", () => {
    expect(parseStoredFilters('{"status":"Fit with Restriction"}')).toEqual({
      status: "Fit with Restriction",
    });
  });

  it("returns null for empty, broken, or non-object payloads", () => {
    expect(parseStoredFilters(null)).toBeNull();
    expect(parseStoredFilters("")).toBeNull();
    expect(parseStoredFilters("{not json")).toBeNull();
    expect(parseStoredFilters("[]")).toBeNull();
    expect(parseStoredFilters('"teks"')).toBeNull();
    expect(parseStoredFilters("{}")).toBeNull();
  });

  it("drops non-string values instead of crashing", () => {
    expect(parseStoredFilters('{"dueSoon":1,"status":"ok"}')).toEqual({ status: "ok" });
  });

  it("round-trips through serializeFilters", () => {
    const values = { status: "Fit to Work", dueSoon: "1" };
    expect(parseStoredFilters(serializeFilters(values))).toEqual(values);
  });
});

describe("presetFromQuery", () => {
  it("maps the due-soon preset used by the dashboard link", () => {
    expect(presetFromQuery("?filter=due-soon")).toEqual({ dueSoon: "1" });
  });

  it("maps the restriction preset", () => {
    expect(presetFromQuery("?filter=restriction")).toEqual({ restriction: "1" });
  });

  it("reads explicit parameters", () => {
    expect(presetFromQuery("?status=Fit+to+Work&search=budi")).toEqual({
      status: "Fit to Work",
      search: "budi",
    });
  });

  it("returns null when nothing usable is present", () => {
    expect(presetFromQuery("")).toBeNull();
    expect(presetFromQuery("?filter=tidak-dikenal")).toBeNull();
  });

  it("exposes every preset with at least one key", () => {
    for (const [name, values] of Object.entries(FILTER_PRESETS)) {
      expect(Object.keys(values).length, `preset ${name} kosong`).toBeGreaterThan(0);
      expect(presetFromQuery(`?filter=${name}`)).toEqual(values);
    }
  });
});

describe("storageKey", () => {
  it("namespaces by page", () => {
    expect(storageKey("health-status")).toBe("emr-filters:health-status");
    expect(storageKey("health-status")).not.toBe(storageKey("visits-queue"));
  });
});
