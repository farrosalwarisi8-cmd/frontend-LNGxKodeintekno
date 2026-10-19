import { describe, it, expect } from "vitest";
import {
  ACTION_PERMISSIONS,
  canPerform,
  isActionId,
  permissionForAction,
  permissionsForAction,
  type ActionId,
} from "../../../lib/actions";
import { allPermissions } from "../../../lib/rbac";
import type { Role } from "../../../lib/types";

describe("ACTION_PERMISSIONS registry", () => {
  it("semua action dipetakan ke permission yang dikenal", () => {
    const known = new Set(allPermissions());
    for (const action of Object.keys(ACTION_PERMISSIONS) as ActionId[]) {
      for (const permission of permissionsForAction(action)) {
        expect(known.has(permission), `${action} → ${permission}`).toBe(true);
      }
    }
  });

  it("mencakup action minimum yang diminta audit", () => {
    const required: ActionId[] = [
      "people.create",
      "people.edit",
      "people.upload-document",
      "people.send-consent",
      "mcu.create",
      "mcu.review",
      "mcu.approve",
      "visits.create",
      "visits.edit-soap",
      "pharmacy.receive-stock",
      "pharmacy.dispense",
      "reports.export",
      "users.manage",
      "master-data.edit",
      "audit.view",
      "certificates.issue",
      "certificates.revoke",
      "documents.request-signature",
      "waiver.decide",
    ];
    for (const action of required) {
      expect(isActionId(action)).toBe(true);
    }
  });

  it("permissionForAction mengembalikan permission yang sama", () => {
    expect(permissionForAction("people.create")).toBe("manage-employees");
    expect(permissionForAction("mcu.approve")).toBe("approve-mcu");
    expect(permissionForAction("reports.export")).toBe("export-reports");
  });
});

describe("canPerform() — action per role", () => {
  it("admin (System Administrator) hanya boleh aksi administrasi", () => {
    expect(canPerform("admin", "users.manage")).toBe(true);
    expect(canPerform("admin", "master-data.edit")).toBe(true);
    expect(canPerform("admin", "audit.view")).toBe(true);
    expect(canPerform("admin", "reports.view")).toBe(true);
    // Tidak ada aksi klinis / farmasi / data pekerja.
    expect(canPerform("admin", "people.create")).toBe(false);
    expect(canPerform("admin", "people.send-consent")).toBe(false);
    expect(canPerform("admin", "pharmacy.dispense")).toBe(false);
    expect(canPerform("admin", "pharmacy.receive-stock")).toBe(false);
    expect(canPerform("admin", "mcu.create")).toBe(false);
    expect(canPerform("admin", "mcu.approve")).toBe(false);
    expect(canPerform("admin", "visits.edit-soap")).toBe(false);
    expect(canPerform("admin", "visits.view-clinical")).toBe(false);
    expect(canPerform("admin", "reports.export")).toBe(false);
  });

  it("hr/pic tidak boleh action klinis & farmasi", () => {
    expect(canPerform("hr", "people.create")).toBe(true);
    expect(canPerform("hr", "people.send-consent")).toBe(true);
    expect(canPerform("hr", "uses.manage" as ActionId)).toBe(false);
    expect(canPerform("hr", "users.manage")).toBe(false);
    expect(canPerform("hr", "master-data.edit")).toBe(false);
    expect(canPerform("hr", "mcu.create")).toBe(false);
    expect(canPerform("hr", "mcu.review")).toBe(false);
    expect(canPerform("hr", "mcu.approve")).toBe(false);
    expect(canPerform("hr", "pharmacy.dispense")).toBe(false);
    expect(canPerform("hr", "pharmacy.receive-stock")).toBe(false);
    expect(canPerform("hr", "visits.edit-soap")).toBe(false);
    expect(canPerform("hr", "visits.view-clinical")).toBe(false);
  });

  it("dokter OH boleh review & approve, tapi tidak kelola user", () => {
    expect(canPerform("dokter-oh", "mcu.review")).toBe(true);
    expect(canPerform("dokter-oh", "mcu.approve")).toBe(true);
    expect(canPerform("dokter-oh", "certificates.issue")).toBe(true);
    expect(canPerform("dokter-oh", "visits.edit-soap")).toBe(true);
    expect(canPerform("dokter-oh", "users.manage")).toBe(false);
    expect(canPerform("dokter-oh", "people.create")).toBe(false);
    expect(canPerform("dokter-oh", "pharmacy.dispense")).toBe(false);
  });

  it("permintaan tanda tangan dokumen mengikuti permission sertifikat", () => {
    expect(canPerform("dokter-oh", "documents.request-signature")).toBe(true);
    expect(canPerform("hr", "documents.request-signature")).toBe(false);
    expect(canPerform("pekerja", "documents.request-signature")).toBe(false);
    expect(permissionForAction("documents.request-signature")).toBe("issue-certificate");
  });

  it("apoteker hanya farmasi", () => {
    expect(canPerform("apoteker", "pharmacy.receive-stock")).toBe(true);
    expect(canPerform("apoteker", "pharmacy.dispense")).toBe(true);
    expect(canPerform("apoteker", "users.manage")).toBe(false);
    expect(canPerform("apoteker", "people.create")).toBe(false);
    expect(canPerform("apoteker", "mcu.review")).toBe(false);
  });

  it("pekerja tidak punya action administratif (hanya aksi baca)", () => {
    const mutating: ActionId[] = [
      "people.create",
      "people.edit",
      "people.upload-document",
      "people.send-consent",
      "mcu.create",
      "mcu.review",
      "mcu.approve",
      "visits.create",
      "visits.edit-soap",
      "pharmacy.receive-stock",
      "pharmacy.dispense",
      "certificates.issue",
      "certificates.revoke",
      "reports.export",
      "users.manage",
      "master-data.edit",
      "waiver.decide",
      "da.manage",
    ];
    for (const action of mutating) {
      expect(canPerform("pekerja", action), action).toBe(false);
    }
  });

  it("role null/unknown → selalu false (fail closed)", () => {
    expect(canPerform(null, "people.create")).toBe(false);
    expect(canPerform(undefined, "people.create")).toBe(false);
    expect(canPerform("unknown" as Role, "people.create")).toBe(false);
  });
});
