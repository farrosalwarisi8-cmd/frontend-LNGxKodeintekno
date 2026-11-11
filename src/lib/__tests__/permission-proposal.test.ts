import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  allPermissions,
  can,
  getPermissionsForRole,
  type Permission,
} from "../../../lib/rbac";
import { canPerform, permissionsForAction } from "../../../lib/actions";
import { resolveRouteAccess } from "@/components/route-guard";
import { getNavigation, getBottomNavigation } from "@/lib/navigation";
import { matchRoutePermission } from "@/components/route-guard";
import type { Role } from "../../../lib/types";

/**
 * A1 — Matriks permission harus sesuai proposal (sumber kebenaran: LAPORAN_A1_
 * STABILISASI_FASE2_4.md bagian "Konteks Proposal").
 *
 * Test ini mengunci HAPUS dan TAMBAH permission per role, serta memastikan
 * pembatasan berlaku di tiga lapis: navigasi (menu), route (AccessDenied),
 * dan aksi (tombol tersembunyi).
 *
 * Melonggarkan assertion di sini berarti membuka akses yang proposal menolak —
 * assertion itu harus diperbarui BUKAN diturunkan.
 */

const ALL_ROLES: Role[] = [
  "admin",
  "dokter-oh",
  "dokter-klinik",
  "perawat",
  "apoteker",
  "lab",
  "admin-klinik",
  "hr",
  "hse",
  "manajemen",
  "pekerja",
];

/** Permission klinis yang TIDAK boleh dimiliki System Administrator. */
const CLINICAL_PERMISSIONS: Permission[] = [
  "view-mcu",
  "review-mcu",
  "approve-mcu",
  "create-mcu",
  "input-mcu-result",
  "view-visits",
  "register-patient",
  "edit-visit",
  "view-clinical-notes",
  "view-diagnosis",
  "manage-stock",
  "dispense-medicine",
  "issue-certificate",
  "set-health-status",
  "input-lab-result",
];

describe("A1 — System Administrator (admin)", () => {
  it("mempertahankan administrasi: user, role, master data, audit log (read-only)", () => {
    expect(can("admin", "manage-users")).toBe(true);
    expect(can("admin", "manage-master-data")).toBe(true);
    expect(can("admin", "view-audit-logs")).toBe(true);
    expect(can("admin", "view-reports")).toBe(true);
    expect(can("admin", "view-health-status")).toBe(true);
    expect(can("admin", "manage-hse")).toBe(true);
    expect(can("admin", "view-emergency")).toBe(true);
    expect(can("admin", "view-dashboard")).toBe(true);
    expect(can("admin", "view-profile")).toBe(true);
    expect(can("admin", "manage-system-config")).toBe(true);
    expect(can("admin", "manage-api-keys")).toBe(true);
    expect(can("admin", "view-tte")).toBe(true);
    expect(can("admin", "monitor-emergency")).toBe(true);
  });

  it("tidak punya akses data klinis sama sekali (positif & negatif per permission)", () => {
    for (const permission of CLINICAL_PERMISSIONS) {
      expect(can("admin", permission), `admin harus TIDAK boleh ${permission}`).toBe(false);
    }
  });

  it("tidak mengelola data pekerja maupun dokumen (bukan domain System Administrator)", () => {
    expect(can("admin", "manage-employees")).toBe(false);
    expect(can("admin", "upload-document")).toBe(false);
    expect(can("admin", "export-reports")).toBe(false);
  });

  it("hanya role ini yang boleh mengelola user & master data", () => {
    const manageUsers = ALL_ROLES.filter((r) => can(r, "manage-users"));
    const manageMaster = ALL_ROLES.filter((r) => can(r, "manage-master-data"));
    expect(manageUsers).toEqual(["admin"]);
    expect(manageMaster).toEqual(["admin"]);
  });
});

describe("A1 — HR/PIC (hr)", () => {
  it("mempertahankan data pekerja + status kepatuhan", () => {
    expect(can("hr", "manage-employees")).toBe(true);
    expect(can("hr", "upload-document")).toBe(true);
    expect(can("hr", "view-health-status")).toBe(true);
    expect(can("hr", "view-dashboard")).toBe(true);
    expect(can("hr", "view-profile")).toBe(true);
  });

  it("tidak mengelola user dan master data", () => {
    expect(can("hr", "manage-users")).toBe(false);
    expect(can("hr", "manage-master-data")).toBe(false);
  });

  it("hanya membuat jadwal MCU; daftar MCU/kunjungan dan detail klinis tetap tertutup", () => {
    expect(can("hr", "view-mcu")).toBe(false);
    expect(can("hr", "view-visits")).toBe(false);
    expect(can("hr", "create-mcu")).toBe(true);
    expect(can("hr", "approve-mcu")).toBe(false);
    expect(can("hr", "review-mcu")).toBe(false);
  });

  it("tidak melihat detail medis", () => {
    expect(can("hr", "view-clinical-notes")).toBe(false);
    expect(can("hr", "view-diagnosis")).toBe(false);
    expect(can("hr", "dispense-medicine")).toBe(false);
    expect(can("hr", "manage-stock")).toBe(false);
    expect(can("hr", "issue-certificate")).toBe(false);
  });

  it("hanya admin yang memegang izin user/master data", () => {
    for (const role of ALL_ROLES) {
      if (role === "admin") continue;
      expect(can(role, "manage-users"), role).toBe(false);
      expect(can(role, "manage-master-data"), role).toBe(false);
    }
  });
});

describe("A1 — Analis Lab/Radiolog (lab)", () => {
  it("mempertahankan input & verifikasi hasil lab (data penunjang)", () => {
    expect(can("lab", "input-lab-result")).toBe(true);
    expect(can("lab", "input-mcu-result")).toBe(true);
    expect(can("lab", "view-dashboard")).toBe(true);
    expect(can("lab", "view-profile")).toBe(true);
  });

  it("tidak punya akses data MCU penuh", () => {
    expect(can("lab", "view-mcu")).toBe(false);
    expect(can("lab", "approve-mcu")).toBe(false);
    expect(can("lab", "review-mcu")).toBe(false);
    expect(can("lab", "view-clinical-notes")).toBe(false);
    expect(can("lab", "view-diagnosis")).toBe(false);
    expect(can("lab", "dispense-medicine")).toBe(false);
  });

  it("hanya lab & dokter-oh yang boleh menginput hasil lab", () => {
    const inputLab = ALL_ROLES.filter((r) => can(r, "input-lab-result"));
    expect(inputLab).toEqual(["dokter-oh", "lab"]);
  });
});

describe("A1 — Admin Klinik (admin-klinik)", () => {
  it("mempertahankan registrasi, antrean, dan entri berobat luar klinik", () => {
    expect(can("admin-klinik", "register-patient")).toBe(true);
    expect(can("admin-klinik", "manage-employees")).toBe(true);
    expect(can("admin-klinik", "upload-document")).toBe(true);
    expect(can("admin-klinik", "view-visits")).toBe(true);
    expect(can("admin-klinik", "edit-visit")).toBe(true);
    expect(can("admin-klinik", "manage-system-config")).toBe(false);
    expect(can("admin-klinik", "manage-api-keys")).toBe(false);
    expect(can("admin-klinik", "view-tte")).toBe(false);
    expect(can("admin-klinik", "monitor-emergency")).toBe(false);
  });

  it("tidak punya akses data klinis", () => {
    // Catatan: `view-visits`, `edit-visit`, dan `register-patient` TIDAK
    // termasuk daftar ini — admin Klinik memang boleh menangani data
    // administratif/antrean, tetapi kolom klinis (keluhan utama, diagnosis)
    // disembunyikan di UI.
    const forbidden = CLINICAL_PERMISSIONS.filter(
      (p) => p !== "view-visits" && p !== "register-patient" && p !== "edit-visit"
    );
    for (const permission of forbidden) {
      expect(can("admin-klinik", permission), `admin-klinik harus TIDAK boleh ${permission}`).toBe(
        false
      );
    }
    expect(can("admin-klinik", "view-clinical-notes")).toBe(false);
    expect(can("admin-klinik", "view-diagnosis")).toBe(false);
  });

  it("tidak mengelola user/master data (dipetakan ke backend SYSTEM_ADMIN)", () => {
    expect(can("admin-klinik", "manage-users")).toBe(false);
    expect(can("admin-klinik", "manage-master-data")).toBe(false);
    expect(can("admin-klinik", "view-audit-logs")).toBe(false);
    expect(can("admin-klinik", "manage-system-config")).toBe(false);
    expect(can("admin-klinik", "manage-api-keys")).toBe(false);
    expect(can("admin-klinik", "view-tte")).toBe(false);
    expect(can("admin-klinik", "monitor-emergency")).toBe(false);
  });
});

describe("A1 — pembatasan berlaku di tiga lapis", () => {
  /** Route yang harus ditolak (AccessDenied) untuk role tertentu. */
  const DENIED_ROUTES: Array<{ role: Role; route: string }> = [
    { role: "admin", route: "/mcu" },
    { role: "admin", route: "/mcu/new" },
    { role: "admin", route: "/mcu/review" },
    { role: "admin", route: "/visits" },
    { role: "admin", route: "/visits/new" },
    { role: "admin", route: "/visits/queue" },
    { role: "admin", route: "/medical-records" },
    { role: "admin", route: "/medicine" },
    { role: "admin", route: "/medicine/dispense" },
    { role: "admin", route: "/medicine/return" },
    { role: "admin", route: "/people" },
    { role: "admin", route: "/people/new" },
    { role: "admin", route: "/employees" },
    { role: "admin", route: "/lab" },
    { role: "admin-klinik", route: "/system-config" },
    { role: "admin-klinik", route: "/api-keys" },
    { role: "admin-klinik", route: "/tte" },
    { role: "admin-klinik", route: "/emergency-detail" },
    { role: "hr", route: "/mcu" },
    { role: "hr", route: "/visits" },
    { role: "hr", route: "/users" },
    { role: "hr", route: "/master-data" },
    { role: "lab", route: "/mcu" },
    { role: "admin-klinik", route: "/mcu" },
    { role: "admin-klinik", route: "/medical-records" },
    { role: "admin-klinik", route: "/medicine/dispense" },
  ];

  it("lapis 1 — menu/navigasi tidak memuat route yang ditolak", () => {
    for (const { role, route } of DENIED_ROUTES) {
      const hrefs = getNavigation(role).map((i) => i.href);
      expect(hrefs, `${role} tidak boleh melihat ${route}`).not.toContain(route);
      const bottom = getBottomNavigation(role).map((i) => i.href);
      expect(bottom, `${role} tidak boleh melihat ${route} di bottom nav`).not.toContain(route);
    }
  });

  it("lapis 2 — route guard menolak role yang tidak berizin", () => {
    for (const { role, route } of DENIED_ROUTES) {
      const required = matchRoutePermission(route);
      expect(required, `${route} harus punya rule guard`).not.toBeNull();
      expect(
        can(role, required!),
        `${role} tidak boleh membuka ${route} (butuh ${required})`
      ).toBe(false);
      expect(
        resolveRouteAccess({
          hydrated: true,
          authenticated: true,
          role,
          pathname: route,
        }),
        `${role} harus mendapat AccessDenied untuk ${route}`
      ).toBe("denied");
    }
  });

  it("lapis 3 — aksi klinis/farmasi tersembunyi untuk role tanpa izin", () => {
    const protectedActions: Array<{
      role: Role;
      action: Parameters<typeof canPerform>[1];
      allowed: boolean;
    }> = [
      { role: "admin", action: "mcu.create", allowed: false },
      { role: "admin", action: "mcu.approve", allowed: false },
      { role: "admin", action: "visits.edit-soap", allowed: false },
      { role: "admin", action: "pharmacy.dispense", allowed: false },
      { role: "admin", action: "people.create", allowed: false },
      { role: "admin-klinik", action: "mcu.create", allowed: false },
      { role: "admin-klinik", action: "mcu.approve", allowed: false },
      { role: "admin-klinik", action: "visits.edit-soap", allowed: false },
      { role: "admin-klinik", action: "pharmacy.dispense", allowed: false },
      { role: "admin-klinik", action: "people.create", allowed: true },
      { role: "hr", action: "mcu.create", allowed: true },
      { role: "hr", action: "users.manage", allowed: false },
      { role: "hr", action: "master-data.edit", allowed: false },
    ];
    for (const { role, action, allowed } of protectedActions) {
      expect(canPerform(role, action), `${role} → ${action}`).toBe(allowed);
    }

    expect(canPerform("admin", "mcu.approve")).toBe(false);
    expect(canPerform("admin", "pharmacy.dispense")).toBe(false);
    expect(canPerform("admin", "people.create")).toBe(false);
    // D&A forensik (manage-da) di luar matriks A1: dipertahankan untuk admin
    // karena termasuk fitur fase lain, bukan data klinis yang dicabut.
    expect(canPerform("admin", "da.manage")).toBe(true);
    expect(canPerform("hr", "mcu.create")).toBe(true);
    expect(canPerform("hr", "users.manage")).toBe(false);
    expect(canPerform("hr", "master-data.edit")).toBe(false);
    expect(canPerform("lab", "visits.edit-soap")).toBe(false);
    expect(canPerform("admin-klinik", "pharmacy.dispense")).toBe(false);
    expect(canPerform("admin-klinik", "da.manage")).toBe(false);
  });

  it("admin-klinik boleh edit-visit tetapi TIDAK boleh SOAP (butuh izin klinis)", () => {
    expect(can("admin-klinik", "edit-visit")).toBe(true);
    expect(can("admin-klinik", "view-clinical-notes")).toBe(false);
    // Aksi SOAP membutuhkan edit-visit DAN view-clinical-notes.
    expect(permissionsForAction("visits.edit-soap")).toEqual([
      "edit-visit",
      "view-clinical-notes",
    ]);
    expect(canPerform("admin-klinik", "visits.edit-soap")).toBe(false);
    expect(canPerform("admin-klinik", "visits.view-clinical")).toBe(false);
    // Role klinis tetap boleh.
    expect(canPerform("dokter-oh", "visits.edit-soap")).toBe(true);
    expect(canPerform("perawat", "visits.edit-soap")).toBe(true);
    // Role admin tetap mengakses kontrol sistem; rule route harus konsisten dengan menu.
    for (const route of ["/system-config", "/api-keys", "/tte", "/emergency-detail"]) {
      const permission = matchRoutePermission(route);
      expect(permission, route).not.toBeNull();
      expect(can("admin", permission!), route).toBe(true);
      expect(getNavigation("admin").map((item) => item.href), route).toContain(route);
    }
  });
});

describe("A1 — invariants registry", () => {
  it("setiap role hanya memetakan permission yang dikenal", () => {
    const known = new Set(allPermissions());
    for (const role of ALL_ROLES) {
      for (const permission of getPermissionsForRole(role)) {
        expect(known.has(permission), `${role}:${permission}`).toBe(true);
      }
    }
  });

  it("tidak ada permission duplikat di dalam satu role", () => {
    for (const role of ALL_ROLES) {
      const perms = getPermissionsForRole(role);
      expect(new Set(perms).size, role).toBe(perms.length);
    }
  });

  it("registry role lengkap (setiap Role punya entri)", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual([...ALL_ROLES].sort());
  });

  it("setiap role punya view-dashboard & view-profile", () => {
    for (const role of ALL_ROLES) {
      expect(can(role, "view-dashboard"), role).toBe(true);
      expect(can(role, "view-profile"), role).toBe(true);
    }
  });
});
