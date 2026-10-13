import { describe, it, expect } from "vitest";
import {
  ROUTE_PERMISSIONS,
  loginRedirectUrl,
  matchRoutePermission,
  resolveRouteAccess,
} from "../../../components/route-guard";
import { allPermissions } from "../../../lib/rbac";

describe("matchRoutePermission()", () => {
  it("matches exact route", () => {
    expect(matchRoutePermission("/dashboard")).toBe("view-dashboard");
    expect(matchRoutePermission("/employees")).toBe("manage-employees");
    expect(matchRoutePermission("/users")).toBe("manage-users");
  });

  it("matches nested routes", () => {
    expect(matchRoutePermission("/mcu/review")).toBe("review-mcu");
    expect(matchRoutePermission("/mcu/new")).toBe("create-mcu");
    expect(matchRoutePermission("/visits/new")).toBe("register-patient");
    expect(matchRoutePermission("/medicine/dispense")).toBe("dispense-medicine");
  });

  it("matches dynamic routes", () => {
    expect(matchRoutePermission("/people/123")).toBe("manage-employees");
    expect(matchRoutePermission("/people/abc/edit")).toBe("manage-employees");
  });

  it("strips trailing slash", () => {
    expect(matchRoutePermission("/dashboard/")).toBe("view-dashboard");
    expect(matchRoutePermission("/mcu/review/")).toBe("review-mcu");
  });

  it("returns null for unmatched routes", () => {
    expect(matchRoutePermission("/demo")).toBeNull();
    expect(matchRoutePermission("/login")).toBeNull();
    expect(matchRoutePermission("/public/consent/token")).toBeNull();
  });

  it("query string does not affect matching", () => {
    expect(matchRoutePermission("/dashboard?tab=stats")).toBe("view-dashboard");
    expect(matchRoutePermission("/users?page=2")).toBe("manage-users");
  });
});

describe("ROUTE_PERMISSIONS", () => {
  it("has unique patterns", () => {
    const patterns = ROUTE_PERMISSIONS.map((r) => r.pattern.source);
    const unique = new Set(patterns);
    expect(patterns.length).toBe(unique.size);
  });

  it("all permissions are valid entries of the registry", () => {
    const valid = new Set(allPermissions());
    for (const rule of ROUTE_PERMISSIONS) {
      expect(valid.has(rule.permission), rule.pattern.source).toBe(true);
    }
  });
});

describe("resolveRouteAccess() — route guard behavior", () => {
  it("belum rehidrasi → loading (tidak memutuskan redirect)", () => {
    expect(
      resolveRouteAccess({
        hydrated: false,
        authenticated: false,
        role: null,
        pathname: "/dashboard",
      })
    ).toBe("loading");
  });

  it("belum login pada route terproteksi → login", () => {
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: false,
        role: null,
        pathname: "/dashboard",
      })
    ).toBe("login");
  });

  it("sudah login & berizin → allow", () => {
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: true,
        role: "admin",
        pathname: "/dashboard",
      })
    ).toBe("allow");
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: true,
        role: "dokter-oh",
        pathname: "/mcu/review",
      })
    ).toBe("allow");
  });

  it("sudah login tetapi tidak berizin → denied (BUKAN redirect otomatis)", () => {
    const access = resolveRouteAccess({
      hydrated: true,
      authenticated: true,
      role: "hr",
      pathname: "/users",
    });
    expect(access).toBe("denied");
    expect(access).not.toBe("login");
    expect(access).not.toBe("allow");
  });

  it("role kosong pada route terproteksi → denied", () => {
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: true,
        role: null,
        pathname: "/mcu/review",
      })
    ).toBe("denied");
  });

  it("route tanpa rule (mis. /demo) → allow untuk pengguna login", () => {
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: true,
        role: "pekerja",
        pathname: "/demo",
      })
    ).toBe("allow");
  });

  it("route tanpa rule & belum login → loading (menunggu sesi)", () => {
    expect(
      resolveRouteAccess({
        hydrated: true,
        authenticated: false,
        role: null,
        pathname: "/demo",
      })
    ).toBe("loading");
  });
});

describe("loginRedirectUrl() — anti open redirect", () => {
  it("mempertahankan path internal", () => {
    expect(loginRedirectUrl("/reports")).toBe("/login?from=%2Freports");
  });

  it("memblokir redirect eksternal", () => {
    expect(loginRedirectUrl("//evil.example.com")).toBe("/login?from=%2Fdashboard");
    expect(loginRedirectUrl("/\\evil")).toBe("/login?from=%2Fdashboard");
  });
});
