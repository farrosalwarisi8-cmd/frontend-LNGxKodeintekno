import { describe, it, expect } from "vitest";
import { PERMISSIONS, getPermissions, hasPermission } from "../permissions";
import type { DemoRole } from "@/features/people/api/people.types";

describe("PERMISSIONS", () => {
  it("ADMIN_CLINIC has full permissions", () => {
    const perms = PERMISSIONS.ADMIN_CLINIC;
    expect(perms.canCreatePerson).toBe(true);
    expect(perms.canEditAdministrativeData).toBe(true);
    expect(perms.canUploadDocument).toBe(true);
    expect(perms.canResendConsent).toBe(true);
    expect(perms.canViewActivity).toBe(true);
    expect(perms.canViewClinicalData).toBe(false);
  });

  it("HR_PIC has limited permissions", () => {
    const perms = PERMISSIONS.HR_PIC;
    expect(perms.canCreatePerson).toBe(true);
    expect(perms.canEditAdministrativeData).toBe(false);
    expect(perms.canUploadDocument).toBe(true);
    expect(perms.canResendConsent).toBe(true);
    expect(perms.canViewActivity).toBe(true);
    expect(perms.canViewClinicalData).toBe(false);
  });

  it("SYSTEM_ADMIN has read-only permissions", () => {
    const perms = PERMISSIONS.SYSTEM_ADMIN;
    expect(perms.canCreatePerson).toBe(false);
    expect(perms.canEditAdministrativeData).toBe(false);
    expect(perms.canUploadDocument).toBe(false);
    expect(perms.canResendConsent).toBe(false);
    expect(perms.canViewActivity).toBe(true);
    expect(perms.canViewClinicalData).toBe(false);
  });

  it("PUBLIC_WORKER has no permissions", () => {
    const perms = PERMISSIONS.PUBLIC_WORKER;
    expect(perms.canCreatePerson).toBe(false);
    expect(perms.canEditAdministrativeData).toBe(false);
    expect(perms.canUploadDocument).toBe(false);
    expect(perms.canResendConsent).toBe(false);
    expect(perms.canViewActivity).toBe(false);
    expect(perms.canViewClinicalData).toBe(false);
  });
});

describe("getPermissions", () => {
  it("returns correct permissions for each role", () => {
    const roles: DemoRole[] = ["ADMIN_CLINIC", "HR_PIC", "SYSTEM_ADMIN", "PUBLIC_WORKER"];
    for (const role of roles) {
      const perms = getPermissions(role);
      expect(perms).toBeDefined();
      expect(typeof perms.canCreatePerson).toBe("boolean");
    }
  });
});

describe("hasPermission", () => {
  it("returns true when permission is granted", () => {
    expect(hasPermission("ADMIN_CLINIC", "canCreatePerson")).toBe(true);
    expect(hasPermission("HR_PIC", "canCreatePerson")).toBe(true);
  });

  it("returns false when permission is denied", () => {
    expect(hasPermission("SYSTEM_ADMIN", "canCreatePerson")).toBe(false);
    expect(hasPermission("PUBLIC_WORKER", "canCreatePerson")).toBe(false);
  });

  it("returns false for clinical data access for all roles", () => {
    const roles: DemoRole[] = ["ADMIN_CLINIC", "HR_PIC", "SYSTEM_ADMIN", "PUBLIC_WORKER"];
    for (const role of roles) {
      expect(hasPermission(role, "canViewClinicalData")).toBe(false);
    }
  });
});
