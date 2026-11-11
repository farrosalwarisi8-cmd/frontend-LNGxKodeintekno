import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, can, type Permission } from "@/lib/rbac";
import { ACTION_PERMISSIONS, canPerform, permissionsForAction } from "@/lib/actions";
import { getNavigation } from "@/lib/navigation";
import { matchRoutePermission } from "@/components/route-guard";
import type { Role } from "@/lib/types";

/**
 * A3 — Permission baru & pemetaannya ke role.
 *
 * Aturan proposal yang dikunci di sini:
 *  - Dokter OH = satu-satunya yang boleh menetapkan FTW & mengelola restriction.
 *  - Admin, admin-klinik, HR, lab, apoteker, manajemen, HSE, dokter klinik,
 *    perawat, dan pekerja TIDAK boleh membuka maupun mengubah modul A3.
 *  - HSE hanya boleh mengakses D&A bila ditunjuk server; data penunjukan
 *    belum ada (BLOCKER BACKEND) → HSE tidak diberi permission apa pun di D&A.
 */

const A3_PERMISSIONS: Permission[] = [
  "review-mcu",
  "set-ftw",
  "manage-restriction",
  "view-resume",
  "view-certificate-preview",
  "view-dna",
  "record-dna-custody",
  "record-dna-confirmation",
];

const OTHER_ROLES: Role[] = [
  "admin",
  "admin-klinik",
  "hr",
  "lab",
  "apoteker",
  "manajemen",
  "hse",
  "dokter-klinik",
  "perawat",
  "pekerja",
];

describe("A3 — permission baru terdaftar di registry", () => {
  it("semua permission A3 ada di ALL_PERMISSIONS", () => {
    for (const permission of A3_PERMISSIONS) {
      expect(ALL_PERMISSIONS).toContain(permission);
    }
  });

  it("tidak ada permission A3 yang bentrok dengan permission lama", () => {
    // `review-mcu` sudah ada sejak A1 — A3 memakai ulang, bukan menduplikasi.
    expect(ALL_PERMISSIONS.filter((p) => p === "review-mcu")).toHaveLength(1);
  });
});

describe("A3 — hanya Dokter OH yang boleh", () => {
  it("memiliki seluruh permission A3", () => {
    for (const permission of A3_PERMISSIONS) {
      expect(can("dokter-oh", permission)).toBe(true);
    }
  });

  it("tidak memberi permission A3 ke role lain", () => {
    for (const role of OTHER_ROLES) {
      for (const permission of A3_PERMISSIONS) {
        expect(can(role, permission), `${role} harus TIDAK punya ${permission}`).toBe(false);
      }
    }
  });
});

describe("A3 — HSE tidak diberi akses D&A", () => {
  it("HSE tidak punya view-dna / record-dna-* (data penunjukan belum tersedia)", () => {
    expect(can("hse", "view-dna")).toBe(false);
    expect(can("hse", "record-dna-custody")).toBe(false);
    expect(can("hse", "record-dna-confirmation")).toBe(false);
  });

  it("HSE tetap punya acknowledgement restriksi (alur lama tidak berubah)", () => {
    expect(can("hse", "acknowledge-restriction")).toBe(true);
  });
});

describe("A3 — registry aksi memakai permission A3", () => {
  it("memetakan aksi ke permission yang benar", () => {
    expect(ACTION_PERMISSIONS["mcu.set-ftw"]).toBe("set-ftw");
    expect(ACTION_PERMISSIONS["mcu.manage-restriction"]).toBe("manage-restriction");
    expect(ACTION_PERMISSIONS["mcu.view-resume"]).toBe("view-resume");
    expect(ACTION_PERMISSIONS["mcu.view-certificate-preview"]).toBe("view-certificate-preview");
    expect(ACTION_PERMISSIONS["dna.view"]).toBe("view-dna");
    expect(ACTION_PERMISSIONS["dna.record-custody"]).toBe("record-dna-custody");
    expect(ACTION_PERMISSIONS["dna.record-confirmation"]).toBe("record-dna-confirmation");
  });

  it("akses aksi mengikuti permission (positif & negatif per role)", () => {
    for (const action of [
      "mcu.set-ftw",
      "mcu.manage-restriction",
      "dna.view",
      "dna.record-custody",
      "dna.record-confirmation",
    ] as const) {
      expect(canPerform("dokter-oh", action)).toBe(true);
      for (const role of OTHER_ROLES) {
        expect(canPerform(role, action), `${role} tidak boleh ${action}`).toBe(false);
      }
    }
  });

  it("setiap aksi A3 punya requirement permission yang dikenal", () => {
    for (const action of [
      "mcu.set-ftw",
      "mcu.manage-restriction",
      "mcu.view-resume",
      "mcu.view-certificate-preview",
      "dna.view",
      "dna.record-custody",
      "dna.record-confirmation",
    ] as const) {
      for (const permission of permissionsForAction(action)) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });
});

describe("A3 — tiga lapis proteksi (menu, route, aksi)", () => {
  it("route /oh-review dijaga review-mcu", () => {
    expect(matchRoutePermission("/oh-review")).toBe("review-mcu");
  });

  it("route /oh-review/restrictions dijaga manage-restriction", () => {
    expect(matchRoutePermission("/oh-review/restrictions")).toBe("manage-restriction");
  });

  it("route /dna dijaga view-dna", () => {
    expect(matchRoutePermission("/dna")).toBe("view-dna");
  });

  it("menu A3 hanya tampil untuk Dokter OH saat flag aktif", () => {
    const previous = process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW;
    const previousDna = process.env.NEXT_PUBLIC_FEATURE_DNA;
    process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW = "1";
    process.env.NEXT_PUBLIC_FEATURE_DNA = "1";
    try {
      const ohHrefs = getNavigation("dokter-oh").map((item) => item.href);
      expect(ohHrefs).toContain("/oh-review");
      expect(ohHrefs).toContain("/oh-review/restrictions");
      expect(ohHrefs).toContain("/dna");

      for (const role of OTHER_ROLES) {
        const hrefs = getNavigation(role).map((item) => item.href);
        expect(hrefs, `${role} tidak boleh melihat menu A3`).not.toContain("/oh-review");
        expect(hrefs).not.toContain("/oh-review/restrictions");
        expect(hrefs).not.toContain("/dna");
      }
    } finally {
      process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW = previous;
      process.env.NEXT_PUBLIC_FEATURE_DNA = previousDna;
    }
  });

  it("menu A3 tersembunyi saat flag mati (perilaku lama tidak berubah)", () => {
    const previous = process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW;
    const previousDna = process.env.NEXT_PUBLIC_FEATURE_DNA;
    delete process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW;
    delete process.env.NEXT_PUBLIC_FEATURE_DNA;
    try {
      const hrefs = getNavigation("dokter-oh").map((item) => item.href);
      expect(hrefs).not.toContain("/oh-review");
      expect(hrefs).not.toContain("/oh-review/restrictions");
      expect(hrefs).not.toContain("/dna");
    } finally {
      process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW = previous;
      process.env.NEXT_PUBLIC_FEATURE_DNA = previousDna;
    }
  });
});
