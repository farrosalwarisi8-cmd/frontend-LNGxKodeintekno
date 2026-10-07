import { describe, it, expect } from "vitest";
import {
  NAVIGATION_ITEMS,
  buildBreadcrumbs,
  isNavActive,
  getNavigation,
  resolveLoginRedirect,
} from "../navigation";

describe("buildBreadcrumbs", () => {
  it("returns Dashboard for root path", () => {
    expect(buildBreadcrumbs("/")).toEqual([{ label: "Dashboard" }]);
  });

  it("returns single active item for top-level known route", () => {
    expect(buildBreadcrumbs("/people")).toEqual([{ label: "People" }]);
    expect(buildBreadcrumbs("/mcu")).toEqual([{ label: "MCU & FTW" }]);
  });

  it("strips trailing slash", () => {
    expect(buildBreadcrumbs("/people/")).toEqual([{ label: "People" }]);
  });

  it("builds parent link + active child for nested known route", () => {
    expect(buildBreadcrumbs("/mcu/review")).toEqual([
      { label: "MCU & FTW", href: "/mcu" },
      { label: "Review MCU" },
    ]);
  });

  it("labels nested visit routes from ROUTE_LABELS", () => {
    expect(buildBreadcrumbs("/visits/new")).toEqual([
      { label: "Kunjungan Klinik", href: "/visits" },
      { label: "Kunjungan Baru" },
    ]);
  });

  it("humanizes unknown segments", () => {
    expect(buildBreadcrumbs("/unknown-thing/detail")).toEqual([
      { label: "Unknown Thing", href: "/unknown-thing" },
      { label: "Detail" },
    ]);
  });

  it("last item never has href (active page)", () => {
    const items = buildBreadcrumbs("/mcu/review");
    expect(items[items.length - 1].href).toBeUndefined();
  });
});

describe("isNavActive", () => {
  it("matches exact path", () => {
    expect(isNavActive("/mcu", "/mcu")).toBe(true);
    expect(isNavActive("/mcu/review", "/mcu")).toBe(true);
    expect(isNavActive("/mcux", "/mcu")).toBe(false);
    expect(isNavActive("/", "/mcu")).toBe(false);
  });

  it("end mode requires exact match", () => {
    expect(isNavActive("/dashboard", "/dashboard", true)).toBe(true);
    expect(isNavActive("/dashboard/", "/dashboard", true)).toBe(false);
    expect(isNavActive("/mcu/review", "/mcu", true)).toBe(false);
  });

  it("dashboard is only active on exact path even without end flag", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard/anything", "/dashboard")).toBe(false);
  });
});

describe("getNavigation", () => {
  it("returns all items for null/undefined role", () => {
    expect(getNavigation(null)).toBe(NAVIGATION_ITEMS);
    expect(getNavigation(undefined)).toBe(NAVIGATION_ITEMS);
  });

  it("admin gets manage-users item", () => {
    const nav = getNavigation("admin");
    expect(nav.some((i) => i.href === "/users")).toBe(true);
  });

  it("admin does not get review-mcu (dokter-oh only)", () => {
    const nav = getNavigation("admin");
    expect(nav.some((i) => i.href === "/mcu/review")).toBe(false);
  });

  it("dokter-oh gets review-mcu but not manage-users", () => {
    const nav = getNavigation("dokter-oh");
    expect(nav.some((i) => i.href === "/mcu/review")).toBe(true);
    expect(nav.some((i) => i.href === "/users")).toBe(false);
  });

  it("apoteker gets dispensing but not register-patient", () => {
    const nav = getNavigation("apoteker");
    expect(nav.some((i) => i.href === "/medicine/dispense")).toBe(true);
    expect(nav.some((i) => i.href === "/visits/new")).toBe(false);
  });

  it("pekerja keeps permissioned items out but keeps disabled items", () => {
    const nav = getNavigation("pekerja");
    expect(nav.some((i) => i.href === "/users")).toBe(false);
    const lab = nav.find((i) => i.href === "/lab");
    expect(lab).toBeDefined();
    expect(lab?.disabled).toBe(true);
  });

  it("every permissioned item is checked with can() semantics", () => {
    // hr: register-patient false, manage-users false
    const nav = getNavigation("hr");
    expect(nav.some((i) => i.href === "/visits/new")).toBe(false);
    expect(nav.some((i) => i.href === "/users")).toBe(false);
    expect(nav.some((i) => i.href === "/employees")).toBe(true);
  });

  it("disabled Lab item never points to /mcu", () => {
    const lab = NAVIGATION_ITEMS.find((i) => i.disabled);
    expect(lab?.href).toBe("/lab");
  });
});

describe("resolveLoginRedirect", () => {
  it("defaults to /dashboard for missing from", () => {
    expect(resolveLoginRedirect(null)).toBe("/dashboard");
    expect(resolveLoginRedirect(undefined)).toBe("/dashboard");
    expect(resolveLoginRedirect("")).toBe("/dashboard");
  });

  it("keeps internal paths", () => {
    expect(resolveLoginRedirect("/people")).toBe("/people");
    expect(resolveLoginRedirect("/mcu/review")).toBe("/mcu/review");
  });

  it("rejects non-internal paths", () => {
    expect(resolveLoginRedirect("people")).toBe("/dashboard");
    expect(resolveLoginRedirect("https://evil.example")).toBe("/dashboard");
    expect(resolveLoginRedirect("//evil.example")).toBe("/dashboard");
    expect(resolveLoginRedirect("/\\evil.example")).toBe("/dashboard");
  });
});
