import { describe, it, expect } from "vitest";
import {
  can,
  canAny,
  canAll,
  getPermissionsForRole,
  ROLE_PERMISSIONS,
  allPermissions,
  type Permission,
} from "../../../lib/rbac";
import type { Role } from "../../../lib/types";

describe("ROLE_PERMISSIONS", () => {
  it("admin (System Administrator) hanya punya izin administrasi, tanpa data klinis", () => {
    const perms = getPermissionsForRole("admin");
    expect(perms).toContain("manage-users");
    expect(perms).toContain("manage-master-data");
    expect(perms).toContain("view-audit-logs");
    expect(perms).toContain("view-reports");
    expect(perms).toContain("view-health-status");
    expect(perms).toContain("manage-hse");
    expect(perms).toContain("view-emergency");
    // Tidak ada akses data klinis (termasuk read-only).
    expect(perms).not.toContain("view-mcu");
    expect(perms).not.toContain("view-visits");
    expect(perms).not.toContain("view-clinical-notes");
    expect(perms).not.toContain("view-diagnosis");
    expect(perms).not.toContain("approve-mcu");
    expect(perms).not.toContain("issue-certificate");
    expect(perms).not.toContain("dispense-medicine");
    expect(perms).not.toContain("manage-stock");
    expect(perms).not.toContain("input-lab-result");
    expect(perms).not.toContain("manage-employees");
  });

  it("hr (HR/PIC) tidak mengelola user/master data dan tidak melihat MCU penuh", () => {
    const perms = getPermissionsForRole("hr");
    expect(perms).toContain("manage-employees");
    expect(perms).toContain("upload-document");
    expect(perms).toContain("view-health-status");
    expect(perms).not.toContain("manage-users");
    expect(perms).not.toContain("manage-master-data");
    expect(perms).not.toContain("view-mcu");
    expect(perms).not.toContain("view-visits");
    expect(perms).not.toContain("create-mcu");
    expect(perms).not.toContain("view-clinical-notes");
  });

  it("lab hanya data penunjang, tanpa akses MCU penuh", () => {
    const perms = getPermissionsForRole("lab");
    expect(perms).toContain("input-lab-result");
    expect(perms).toContain("input-mcu-result");
    expect(perms).not.toContain("view-mcu");
    expect(perms).not.toContain("view-clinical-notes");
    expect(perms).not.toContain("view-diagnosis");
    expect(perms).not.toContain("dispense-medicine");
  });

  it("admin-klinik boleh registrasi/antrean tetapi tanpa data klinis", () => {
    const perms = getPermissionsForRole("admin-klinik");
    expect(perms).toContain("register-patient");
    expect(perms).toContain("manage-employees");
    expect(perms).toContain("upload-document");
    expect(perms).toContain("view-visits");
    expect(perms).not.toContain("view-mcu");
    expect(perms).not.toContain("create-mcu");
    expect(perms).not.toContain("dispense-medicine");
    expect(perms).not.toContain("view-clinical-notes");
    expect(perms).not.toContain("view-diagnosis");
    expect(perms).not.toContain("manage-users");
  });

  it("dokter-oh has review-mcu but not manage-users", () => {
    const perms = getPermissionsForRole("dokter-oh");
    expect(perms).toContain("review-mcu");
    expect(perms).toContain("issue-certificate");
    expect(perms).not.toContain("manage-users");
    expect(perms).not.toContain("manage-employees");
  });

  it("pekerja has minimal permissions", () => {
    const perms = getPermissionsForRole("pekerja");
    expect(perms).toContain("view-dashboard");
    expect(perms).toContain("view-profile");
    expect(perms).not.toContain("manage-users");
    expect(perms).not.toContain("manage-employees");
    expect(perms).not.toContain("review-mcu");
  });

  it("registry role lengkap (tanpa permission yatim)", () => {
    const known = new Set(allPermissions());
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const permission of perms) {
        expect(known.has(permission), `${role}:${permission}`).toBe(true);
      }
    }
  });

  it("every role has view-dashboard", () => {
    const roles: Role[] = [
      "admin", "dokter-oh", "dokter-klinik", "perawat", "apoteker",
      "lab", "admin-klinik", "hr", "hse", "manajemen", "pekerja",
    ];
    for (const role of roles) {
      expect(can(role, "view-dashboard")).toBe(true);
    }
  });
});

describe("can()", () => {
  it("returns true for valid permission", () => {
    expect(can("admin", "manage-users")).toBe(true);
    expect(can("dokter-oh", "review-mcu")).toBe(true);
  });

  it("returns false for invalid permission", () => {
    expect(can("pekerja", "manage-users")).toBe(false);
    expect(can("hr", "manage-users")).toBe(false);
  });

  it("returns false for unknown permission", () => {
    expect(can("admin", "nonexistent" as Permission)).toBe(false);
  });
});

describe("canAny()", () => {
  it("returns true if any permission is granted", () => {
    expect(canAny("dokter-oh", ["review-mcu", "manage-users"])).toBe(true);
  });

  it("returns false if no permission is granted", () => {
    expect(canAny("pekerja", ["manage-users", "manage-employees"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(canAny("admin", [])).toBe(false);
  });
});

describe("canAll()", () => {
  it("returns true if all permissions are granted", () => {
    expect(canAll("admin", ["manage-users", "manage-master-data"])).toBe(true);
    expect(canAll("admin", ["manage-users", "view-audit-logs"])).toBe(true);
  });

  it("returns false if any permission is missing", () => {
    expect(canAll("hr", ["manage-employees", "manage-users"])).toBe(false);
    expect(canAll("admin", ["manage-users", "view-mcu"])).toBe(false);
  });

  it("returns true for empty array", () => {
    expect(canAll("admin", [])).toBe(true);
  });
});

describe("getPermissionsForRole()", () => {
  it("returns correct permissions for each role", () => {
    expect(getPermissionsForRole("admin")).toContain("manage-master-data");
    expect(getPermissionsForRole("hse")).toContain("manage-hse");
    expect(getPermissionsForRole("apoteker")).toContain("dispense-medicine");
  });

  it("returns empty array for unknown role", () => {
    expect(getPermissionsForRole("unknown" as Role)).toEqual([]);
  });
});
