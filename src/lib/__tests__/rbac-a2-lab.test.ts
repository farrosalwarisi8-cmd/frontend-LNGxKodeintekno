import { describe, it, expect, afterEach, vi } from "vitest";
import { can, ROLE_PERMISSIONS, type Permission } from "../../../lib/rbac";
import { canPerform } from "../../../lib/actions";
import { resolveRouteAccess, matchRoutePermission } from "../../../components/route-guard";
import { NAVIGATION_ITEMS, getNavigation } from "../navigation";
import { isLabRadiologyEnabled } from "../feature-flags";
import { isFeatureLabEnabled } from "../env";
import type { Role } from "../../../lib/types";

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

describe("A2 — permission baru per role (positif & negatif)", () => {
  const expectOnly = (permission: Permission, allowed: Role[]) => {
    for (const role of ALL_ROLES) {
      expect(
        can(role, permission),
        `${role} ${allowed.includes(role) ? "seharusnya" : "tidak seharusnya"} punya ${permission}`
      ).toBe(allowed.includes(role));
    }
  };

  it("verify-lab-result HANYA role analis lab", () => {
    expectOnly("verify-lab-result", ["lab"]);
  });

  it("receive-sample HANYA role analis lab", () => {
    expectOnly("receive-sample", ["lab"]);
  });

  it("write-radiology-report HANYA role analis lab/radiolog", () => {
    expectOnly("write-radiology-report", ["lab"]);
  });

  it("import-lab-result: analis lab + admin", () => {
    expectOnly("import-lab-result", ["lab", "admin"]);
  });

  it("view-lab-orders: role klinis yang boleh melihat penunjang", () => {
    expectOnly("view-lab-orders", ["admin", "dokter-oh", "dokter-klinik", "perawat", "lab"]);
  });

  it("role lab tetap tanpa view-mcu (prasyarat A1) namun punya izin lab lengkap", () => {
    expect(can("lab", "view-mcu")).toBe(false);
    expect(can("lab", "view-lab-orders")).toBe(true);
    expect(can("lab", "input-lab-result")).toBe(true);
    expect(can("lab", "receive-sample")).toBe(true);
    expect(can("lab", "import-lab-result")).toBe(true);
    expect(can("lab", "verify-lab-result")).toBe(true);
    expect(can("lab", "write-radiology-report")).toBe(true);
  });

  it("role non-lab tidak mendapat izin aksi lab secara diam-diam", () => {
    for (const role of ALL_ROLES.filter((r) => r !== "lab")) {
      expect(can(role, "receive-sample"), role).toBe(false);
      expect(can(role, "verify-lab-result"), role).toBe(false);
      expect(can(role, "write-radiology-report"), role).toBe(false);
    }
  });
});

describe("A2 — registry aksi (tiga lapis proteksi: aksi)", () => {
  it("aksi verifikasi/impor/terima sampel/laporan radiologi terpetakan", () => {
    expect(canPerform("lab", "lab.verify")).toBe(true);
    expect(canPerform("lab", "lab.import")).toBe(true);
    expect(canPerform("lab", "lab.receive-sample")).toBe(true);
    expect(canPerform("lab", "radiology.write-report")).toBe(true);
  });

  it("admin boleh impor tetapi TIDAK boleh verifikasi/radiologi", () => {
    expect(canPerform("admin", "lab.import")).toBe(true);
    expect(canPerform("admin", "lab.verify")).toBe(false);
    expect(canPerform("admin", "lab.receive-sample")).toBe(false);
    expect(canPerform("admin", "radiology.write-report")).toBe(false);
  });
});

describe("A2 — guard route baru (tiga lapis proteksi: route)", () => {
  it("/radiology → write-radiology-report", () => {
    expect(matchRoutePermission("/radiology")).toBe("write-radiology-report");
    expect(matchRoutePermission("/radiology/")).toBe("write-radiology-report");
  });

  it("/lab/import → import-lab-result (lebih spesifik dari /lab)", () => {
    expect(matchRoutePermission("/lab/import")).toBe("import-lab-result");
    expect(matchRoutePermission("/lab/import/preview")).toBe("import-lab-result");
    expect(matchRoutePermission("/lab")).toBe("input-lab-result");
    expect(matchRoutePermission("/lab/ord-123")).toBe("input-lab-result");
  });

  it("keputusan akses: role tanpa izin ditolak, role berizin lolos", () => {
    const base = { hydrated: true, authenticated: true };
    // Radiologi: analis lab lolos, admin & perawat ditolak.
    expect(resolveRouteAccess({ ...base, role: "lab", pathname: "/radiology" })).toBe("allow");
    expect(resolveRouteAccess({ ...base, role: "admin", pathname: "/radiology" })).toBe("denied");
    expect(resolveRouteAccess({ ...base, role: "perawat", pathname: "/radiology" })).toBe("denied");
    // Import: analis & admin lolos, dokter-oh (punya view-lab) ditolak.
    expect(resolveRouteAccess({ ...base, role: "lab", pathname: "/lab/import" })).toBe("allow");
    expect(resolveRouteAccess({ ...base, role: "admin", pathname: "/lab/import" })).toBe("allow");
    expect(resolveRouteAccess({ ...base, role: "dokter-oh", pathname: "/lab/import" })).toBe(
      "denied"
    );
    // Role tanpa izin lab sama sekali tetap ditolak di /lab.
    expect(resolveRouteAccess({ ...base, role: "apoteker", pathname: "/lab" })).toBe("denied");
  });
});

describe("A2 — feature flag menu (tiga lapis proteksi: menu)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("item Radiologi ada di registry dengan permission & flag yang benar", () => {
    const item = NAVIGATION_ITEMS.find((i) => i.href === "/radiology");
    expect(item).toBeDefined();
    expect(item?.permission).toBe("write-radiology-report");
    expect(item?.featureFlag).toBe("lab-radiology");
  });

  it("flag mati (default) → menu Radiologi tidak tampil, menu Lab tetap", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LAB", "");
    const nav = getNavigation("lab").map((i) => i.href);
    expect(nav).not.toContain("/radiology");
    expect(nav).toContain("/lab");
  });

  it("flag aktif → menu Radiologi tampil hanya untuk role berizin", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LAB", "1");
    expect(getNavigation("lab").map((i) => i.href)).toContain("/radiology");
    expect(getNavigation("admin").map((i) => i.href)).not.toContain("/radiology");
    expect(getNavigation("perawat").map((i) => i.href)).not.toContain("/radiology");
  });
});

describe("isFeatureLabEnabled — pembacaan flag", () => {
  it("default MATI (tanpa env)", () => {
    expect(isFeatureLabEnabled(undefined)).toBe(false);
    expect(isFeatureLabEnabled("")).toBe(false);
    expect(isFeatureLabEnabled("false")).toBe(false);
    expect(isFeatureLabEnabled("0")).toBe(false);
  });

  it("hanya nilai truthy eksplisit yang mengaktifkan", () => {
    expect(isFeatureLabEnabled("1")).toBe(true);
    expect(isFeatureLabEnabled("true")).toBe(true);
    expect(isFeatureLabEnabled("TRUE")).toBe(true);
    expect(isFeatureLabEnabled(" yes ")).toBe(true);
    expect(isFeatureLabEnabled("on")).toBe(true);
  });

  it("isLabRadiologyEnabled membaca env runtime (default mati di test)", () => {
    expect(typeof isLabRadiologyEnabled()).toBe("boolean");
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LAB", "0");
    expect(isLabRadiologyEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FEATURE_LAB", "1");
    expect(isLabRadiologyEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
