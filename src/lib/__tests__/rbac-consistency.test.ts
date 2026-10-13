import { describe, expect, it } from "vitest";
import {
  PRIVILEGED_PERMISSIONS,
  ROLE_PERMISSIONS,
  allPermissions,
  can,
  getPermissionsForRole,
} from "../../../lib/rbac";
import { ACTION_PERMISSIONS, canPerform, isActionId } from "../../../lib/actions";
import { NAVIGATION_ITEMS, BOTTOM_NAV_ITEMS } from "@/lib/navigation";
import { ROUTE_PERMISSIONS, matchRoutePermission } from "../../../components/route-guard";
import type { Role } from "../../../lib/types";

const ROLE_LIST = Object.keys(ROLE_PERMISSIONS) as Role[];

/**
 * Gap F2-B — konsistensi tiga lapisan frontend:
 * navigasi (menu) + route guard (direct URL) + aksi/tombol (permission).
 * Permission frontend BUKAN pengganti otorisasi backend.
 */
describe("registry permission konsisten", () => {
  it("semua permission yang dipakai navigasi/guard/aksi terdaftar di registry", () => {
    const known = new Set(allPermissions());

    for (const item of NAVIGATION_ITEMS) {
      if (item.permission) expect(known.has(item.permission), `nav ${item.href}`).toBe(true);
    }
    for (const rule of ROUTE_PERMISSIONS) {
      expect(known.has(rule.permission), `guard ${rule.pattern}`).toBe(true);
    }
    for (const [action, permission] of Object.entries(ACTION_PERMISSIONS)) {
      expect(known.has(permission), `action ${action}`).toBe(true);
    }
    for (const permission of PRIVILEGED_PERMISSIONS) {
      expect(known.has(permission), `privileged ${permission}`).toBe(true);
    }
  });

  it("setiap permission yang dipakai diberikan ke minimal satu role (tidak ada permission yatim)", () => {
    const used = new Set<string>([
      ...(NAVIGATION_ITEMS.map((i) => i.permission).filter(Boolean) as string[]),
      ...ROUTE_PERMISSIONS.map((r) => r.permission),
      ...Object.values(ACTION_PERMISSIONS),
    ]);
    for (const permission of used) {
      const holders = ROLE_LIST.filter((role) => can(role, permission as never));
      expect(holders.length, permission).toBeGreaterThan(0);
    }
  });

  it("role hanya memetakan permission yang dikenal", () => {
    const known = new Set(allPermissions());
    for (const role of ROLE_LIST) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(known.has(permission), `${role}:${permission}`).toBe(true);
      }
    }
  });

  it("menu, route guard, dan aksi memakai permission yang SAMA untuk route yang sama", () => {
    for (const item of NAVIGATION_ITEMS) {
      const guardPermission = matchRoutePermission(item.href);
      if (!guardPermission || !item.permission) continue;
      expect(guardPermission, `nav ${item.href}`).toBe(item.permission);
    }
  });

  it("setiap item navigasi boleh dibuka oleh semua role yang melihatnya", () => {
    for (const item of NAVIGATION_ITEMS) {
      const guardPermission = matchRoutePermission(item.href);
      if (!guardPermission) continue;
      for (const role of ROLE_LIST) {
        if (item.permission && can(role, item.permission)) {
          expect(can(role, guardPermission), `${role} → ${item.href}`).toBe(true);
        }
      }
    }
  });

  it("bottom navigation adalah subset dari navigasi utama (tanpa permission kedua)", () => {
    const mainHrefs = new Set(NAVIGATION_ITEMS.map((i) => i.href));
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(mainHrefs.has(item.href), item.href).toBe(true);
    }
  });

  it("route tanpa rule guard tidak memakai permission di menu", () => {
    // /demo tidak punya guard & tidak punya permission → konsisten.
    const ungarded = NAVIGATION_ITEMS.filter((i) => !matchRoutePermission(i.href));
    for (const item of ungarded) {
      expect(item.permission, item.href).toBeUndefined();
    }
  });
});

describe("F2-A — acknowledgement restriksi HSE hanya untuk HSE", () => {
  it("hanya role hse yang dapat acknowledge-restriction", () => {
    const allowed = ROLE_LIST.filter((role) => can(role, "acknowledge-restriction"));
    expect(allowed).toEqual(["hse"]);
  });

  it("tombol/action mcu.acknowledge-restriction tersembunyi untuk role non-HSE", () => {
    expect(isActionId("mcu.acknowledge-restriction")).toBe(true);
    expect(canPerform("hse", "mcu.acknowledge-restriction")).toBe(true);
    for (const role of ROLE_LIST.filter((r) => r !== "hse")) {
      expect(canPerform(role, "mcu.acknowledge-restriction"), role).toBe(false);
    }
    expect(canPerform(null, "mcu.acknowledge-restriction")).toBe(false);
    expect(canPerform(undefined, "mcu.acknowledge-restriction")).toBe(false);
  });

  it("halaman pemilik UI tetap dapat dibuka HSE (nav = guard = view-health-status)", () => {
    expect(matchRoutePermission("/health-status")).toBe("view-health-status");
    const navItem = NAVIGATION_ITEMS.find((i) => i.href === "/health-status");
    expect(navItem?.permission).toBe("view-health-status");
    expect(can("hse", "view-health-status")).toBe(true);
  });

  it("dokter-klinik tetap punya create-mcu (gap F2 #6 tidak kambuh)", () => {
    expect(canPerform("dokter-klinik", "mcu.create")).toBe(true);
    expect(matchRoutePermission("/mcu/new")).toBe("create-mcu");
  });

  it("HR/PIC tetap punya employee & consent action", () => {
    expect(canPerform("hr", "people.create")).toBe(true);
    expect(canPerform("hr", "people.send-consent")).toBe(true);
  });

  it("public consent tidak butuh sesi (tanpa permission frontend)", () => {
    // /public/* tidak punya rule guard → hanya butuh token, bukan role.
    expect(matchRoutePermission("/public/consent/abc")).toBeNull();
  });
});

describe("permission registry tidak melampaui backend", () => {
  it("acknowledge-restriction tidak diberikan ke role selain HSE meski backend juga mengizinkan HR/system admin", () => {
    // Backend: HSE_OFFICER, HSE_MANAGER, HR_ADMIN, SYSTEM_ADMIN.
    // UI sengaja lebih sempit (hse) — lebih sempit selalu aman.
    expect(getPermissionsForRole("hr")).not.toContain("acknowledge-restriction");
    expect(getPermissionsForRole("admin")).not.toContain("acknowledge-restriction");
  });
});
