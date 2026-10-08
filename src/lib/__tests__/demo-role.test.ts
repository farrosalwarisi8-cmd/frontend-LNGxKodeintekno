import { describe, it, expect } from "vitest";
import {
  DEMO_ROLES,
  DEMO_ROLE_LABELS,
  DEMO_ROLE_TO_ROLE,
} from "../../../src/lib/demo-role-map";
import { ROLE_PERMISSIONS } from "../../../lib/rbac";
import { canPerform } from "../../../lib/actions";
import { getBottomNavigation, getNavigation } from "../../../src/lib/navigation";

describe("DEMO_ROLE_TO_ROLE", () => {
  it("memetakan setiap DemoRole ke role session yang valid", () => {
    for (const demoRole of DEMO_ROLES) {
      const role = DEMO_ROLE_TO_ROLE[demoRole];
      expect(role, `mapping untuk ${demoRole}`).toBeDefined();
      expect(Object.keys(ROLE_PERMISSIONS)).toContain(role);
    }
  });

  it("tidak ada DemoRole yang terlewat dari daftar", () => {
    expect(Object.keys(DEMO_ROLE_TO_ROLE).sort()).toEqual([...DEMO_ROLES].sort());
  });

  it("setiap role demo punya label", () => {
    for (const demoRole of DEMO_ROLES) {
      expect(DEMO_ROLE_LABELS[demoRole]).toBeTruthy();
    }
  });
});

describe("konsistensi demo role dengan menu & bottom navigation", () => {
  it("mengubah demo role mengubah menu (mapping tunggal)", () => {
    const hrNav = getNavigation(DEMO_ROLE_TO_ROLE.HR_PIC).map((i) => i.href);
    const adminNav = getNavigation(DEMO_ROLE_TO_ROLE.SYSTEM_ADMIN).map((i) => i.href);
    const workerNav = getNavigation(DEMO_ROLE_TO_ROLE.PUBLIC_WORKER).map((i) => i.href);

    expect(adminNav).toContain("/users");
    expect(hrNav).not.toContain("/users");
    expect(workerNav).not.toContain("/users");
    expect(workerNav).not.toContain("/medicine");
    expect(hrNav).not.toContain("/medicine");
  });

  it("mengubah demo role mengubah bottom navigation", () => {
    expect(getBottomNavigation(DEMO_ROLE_TO_ROLE.SYSTEM_ADMIN).map((i) => i.href)).toContain(
      "/medicine"
    );
    expect(getBottomNavigation(DEMO_ROLE_TO_ROLE.HR_PIC).map((i) => i.href)).not.toContain(
      "/medicine"
    );
    expect(getBottomNavigation(DEMO_ROLE_TO_ROLE.PUBLIC_WORKER).map((i) => i.href)).not.toContain(
      "/medicine"
    );
  });

  it("mengubah demo role mengubah action button", () => {
    expect(canPerform(DEMO_ROLE_TO_ROLE.HR_PIC, "people.create")).toBe(true);
    expect(canPerform(DEMO_ROLE_TO_ROLE.PUBLIC_WORKER, "people.create")).toBe(false);
    expect(canPerform(DEMO_ROLE_TO_ROLE.SYSTEM_ADMIN, "users.manage")).toBe(true);
    expect(canPerform(DEMO_ROLE_TO_ROLE.HR_PIC, "users.manage")).toBe(false);
    expect(canPerform(DEMO_ROLE_TO_ROLE.PUBLIC_WORKER, "users.manage")).toBe(false);
  });

  it("demo role bukan authorization produksi: permission tetap dari registry role", () => {
    // ADMIN_CLINIC dipetakan ke admin-klinik — bukan superuser.
    expect(canPerform(DEMO_ROLE_TO_ROLE.ADMIN_CLINIC, "users.manage")).toBe(false);
    expect(canPerform(DEMO_ROLE_TO_ROLE.ADMIN_CLINIC, "mcu.approve")).toBe(false);
    expect(canPerform(DEMO_ROLE_TO_ROLE.ADMIN_CLINIC, "reports.export")).toBe(false);
  });
});
