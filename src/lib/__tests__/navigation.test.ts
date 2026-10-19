import { describe, it, expect } from "vitest";
import {
  BOTTOM_NAV_ITEMS,
  NAVIGATION_ITEMS,
  buildBreadcrumbs,
  getBottomNavigation,
  getNavigation,
  getOverflowNavigation,
  isNavActive,
  resolveLoginRedirect,
} from "../../../src/lib/navigation";
import type { Role } from "../../../lib/types";

function hrefs(role: Role | null): string[] {
  return getNavigation(role).map((i) => i.href);
}

describe("getNavigation() — filtering per role", () => {
  it("returns nothing without a role (tidak ada sesi → tidak ada menu)", () => {
    expect(getNavigation(null)).toEqual([]);
    expect(getNavigation(undefined)).toEqual([]);
  });

  it("admin (System Administrator) melihat modul administrasi, tanpa modul klinis", () => {
    const nav = hrefs("admin");
    expect(nav).toContain("/dashboard");
    expect(nav).toContain("/users");
    expect(nav).toContain("/master-data");
    expect(nav).toContain("/audit-logs");
    expect(nav).toContain("/reports");
    expect(nav).toContain("/health-status");
    // Tidak ada akses data klinis (termasuk read-only).
    expect(nav).not.toContain("/medicine");
    expect(nav).not.toContain("/medicine/dispense");
    expect(nav).not.toContain("/people");
    expect(nav).not.toContain("/employees");
    expect(nav).not.toContain("/mcu");
    expect(nav).not.toContain("/mcu/review");
    expect(nav).not.toContain("/visits");
    expect(nav).not.toContain("/visits/new");
    expect(nav).not.toContain("/medical-records");
    expect(nav).not.toContain("/lab");
  });

  it("hr (HR/PIC) melihat data pekerja & kepatuhan, tanpa user/master data atau MCU", () => {
    const nav = hrefs("hr");
    expect(nav).toContain("/people");
    expect(nav).toContain("/employees");
    expect(nav).toContain("/health-status");
    expect(nav).not.toContain("/medicine");
    expect(nav).not.toContain("/medicine/dispense");
    expect(nav).not.toContain("/users");
    expect(nav).not.toContain("/master-data");
    expect(nav).not.toContain("/mcu");
    expect(nav).not.toContain("/mcu/review");
    expect(nav).not.toContain("/visits");
    expect(nav).not.toContain("/audit-logs");
  });

  it("admin-klinik melihat registrasi/antrean, tanpa data klinis", () => {
    const nav = hrefs("admin-klinik");
    expect(nav).toContain("/people");
    expect(nav).toContain("/visits");
    expect(nav).toContain("/visits/new");
    expect(nav).toContain("/visits/queue");
    expect(nav).not.toContain("/mcu");
    expect(nav).not.toContain("/medical-records");
    expect(nav).not.toContain("/medicine");
    expect(nav).not.toContain("/medicine/dispense");
    expect(nav).not.toContain("/users");
  });

  it("dokter-oh sees review & certificates but not users/pharmacy", () => {
    const nav = hrefs("dokter-oh");
    expect(nav).toContain("/mcu/review");
    expect(nav).toContain("/certificates");
    expect(nav).not.toContain("/users");
    expect(nav).not.toContain("/medicine");
    expect(nav).not.toContain("/master-data");
  });

  it("perawat can register visits but not dispense", () => {
    const nav = hrefs("perawat");
    expect(nav).toContain("/visits/new");
    expect(nav).toContain("/mcu");
    expect(nav).not.toContain("/medicine/dispense");
    expect(nav).not.toContain("/users");
  });

  it("apoteker sees pharmacy but no clinical review or users", () => {
    const nav = hrefs("apoteker");
    expect(nav).toContain("/medicine");
    expect(nav).toContain("/medicine/dispense");
    expect(nav).not.toContain("/mcu/review");
    expect(nav).not.toContain("/users");
    expect(nav).not.toContain("/visits/new");
  });

  it("pekerja only sees personal/read-only modules", () => {
    const nav = hrefs("pekerja");
    expect(nav).toContain("/dashboard");
    expect(nav).toContain("/health-status");
    expect(nav).not.toContain("/users");
    expect(nav).not.toContain("/medicine");
    expect(nav).not.toContain("/people");
    expect(nav).not.toContain("/mcu/review");
    expect(nav).not.toContain("/visits/new");
  });

  it("tidak ada role yang melihat menu di luar registry (semua item punya permission atau disabled)", () => {
    const roles: Role[] = [
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
    const known = new Set(NAVIGATION_ITEMS.map((i) => i.href));
    for (const role of roles) {
      for (const href of hrefs(role)) {
        expect(known.has(href)).toBe(true);
      }
    }
  });
});

describe("Lab & Radiologi navigation", () => {
  it("Lab & Radiologi tampil untuk role dengan permission input-lab-result", () => {
    for (const role of ["dokter-oh", "lab"] as Role[]) {
      const lab = getNavigation(role).find((i) => i.href === "/lab");
      expect(lab).toBeDefined();
      expect(lab?.disabled).toBeUndefined();
    }
  });

  it("Lab & Radiologi tidak tampil untuk role tanpa permission", () => {
    for (const role of ["pekerja", "hr", "manajemen", "admin", "admin-klinik"] as Role[]) {
      const lab = getNavigation(role).find((i) => i.href === "/lab");
      expect(lab).toBeUndefined();
    }
  });
});

describe("getBottomNavigation() — permission registry yang sama", () => {
  it("setiap item bottom nav punya permission (tidak ada mapping kedua)", () => {
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(item.permission).toBeDefined();
    }
  });

  it("semua href bottom nav ada di NAVIGATION_ITEMS (satu sumber)", () => {
    const known = new Set(NAVIGATION_ITEMS.map((i) => i.href));
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(known.has(item.href)).toBe(true);
    }
  });

  it("hr tidak melihat Farmasi di bottom navigation", () => {
    const hrefs = getBottomNavigation("hr").map((i) => i.href);
    expect(hrefs).toEqual(["/dashboard"]);
  });

  it("pekerja tidak melihat Farmasi di bottom navigation", () => {
    const hrefs = getBottomNavigation("pekerja").map((i) => i.href);
    expect(hrefs).not.toContain("/medicine");
    expect(hrefs).toContain("/dashboard");
  });

  it("apoteker melihat Farmasi; admin (System Administrator) tidak", () => {
    expect(getBottomNavigation("apoteker").map((i) => i.href)).toContain("/medicine");
    // System Administrator tidak punya akses data klinis/farmasi.
    expect(getBottomNavigation("admin").map((i) => i.href)).toEqual(["/dashboard"]);
  });

  it("lab/perawat/admin-klinik mengikuti registry", () => {
    // lab tidak punya view-mcu lagi (hanya data penunjang).
    expect(getBottomNavigation("lab").map((i) => i.href)).toEqual(["/dashboard"]);
    expect(getBottomNavigation("perawat").map((i) => i.href)).toEqual([
      "/dashboard",
      "/mcu",
      "/visits",
    ]);
    // admin-klinik punya dispense-medicine TIDAK lagi dan manage-stock juga tidak.
    expect(getBottomNavigation("admin-klinik").map((i) => i.href)).not.toContain("/medicine");
    expect(getBottomNavigation("admin-klinik").map((i) => i.href)).toContain("/visits");
  });

  it("tanpa sesi → bottom navigation kosong", () => {
    expect(getBottomNavigation(null)).toEqual([]);
  });

  it("memakai label ringkas khusus bottom bar (presentasi, bukan permission baru)", () => {
    const labels = getBottomNavigation("apoteker").map((i) => i.label);
    expect(labels).toEqual(["Dashboard", "MCU", "Farmasi"]);
    const perawatLabels = getBottomNavigation("perawat").map((i) => i.label);
    expect(perawatLabels).toEqual(["Dashboard", "MCU", "Kunjungan"]);
  });

  it("tidak ada link bottom nav yang pasti ditolak route guard", () => {
    const roles: Role[] = ["admin", "hr", "pekerja", "apoteker", "perawat", "lab", "admin-klinik", "dokter-oh"];
    for (const role of roles) {
      for (const item of getBottomNavigation(role)) {
        // bottom nav butuh izin item itu sendiri → selalu boleh dibuka
        expect(item.disabled).toBeFalsy();
      }
    }
  });
});

describe("getOverflowNavigation()", () => {
  it("berisi item di luar bottom nav sehingga tombol Lainnya berguna", () => {
    const overflow = getOverflowNavigation("hr").map((i) => i.href);
    expect(overflow).not.toContain("/dashboard");
    expect(overflow).not.toContain("/mcu");
    expect(overflow).toContain("/reports");
  });

  it("kosong saat tanpa sesi", () => {
    expect(getOverflowNavigation(null)).toEqual([]);
  });
});

describe("isNavActive()", () => {
  it("parent aktif untuk nested route", () => {
    expect(isNavActive("/mcu/review", "/mcu")).toBe(true);
    expect(isNavActive("/medicine/dispense", "/medicine")).toBe(true);
    expect(isNavActive("/visits/new", "/visits")).toBe(true);
  });

  it("tidak aktif untuk route lain", () => {
    expect(isNavActive("/users", "/medicine")).toBe(false);
  });

  it("item `end` hanya aktif persis", () => {
    expect(isNavActive("/dashboard", "/dashboard", true)).toBe(true);
    expect(isNavActive("/dashboard/x", "/dashboard", true)).toBe(false);
  });
});

describe("resolveLoginRedirect()", () => {
  it("menerima path internal", () => {
    expect(resolveLoginRedirect("/reports")).toBe("/reports");
    expect(resolveLoginRedirect("/mcu/review?tab=1")).toBe("/mcu/review?tab=1");
  });

  it("menolak redirect eksternal", () => {
    expect(resolveLoginRedirect("https://evil.example.com")).toBe("/dashboard");
    expect(resolveLoginRedirect("//evil.example.com")).toBe("/dashboard");
    expect(resolveLoginRedirect("/\\evil")).toBe("/dashboard");
    expect(resolveLoginRedirect("javascript:alert(1)")).toBe("/dashboard");
  });

  it("default ke /dashboard", () => {
    expect(resolveLoginRedirect(null)).toBe("/dashboard");
    expect(resolveLoginRedirect(undefined)).toBe("/dashboard");
    expect(resolveLoginRedirect("")).toBe("/dashboard");
  });
});

describe("buildBreadcrumbs()", () => {
  it("membangun breadcrumb bertingkat", () => {
    expect(buildBreadcrumbs("/mcu/review")).toEqual([
      { label: "MCU & FTW", href: "/mcu" },
      { label: "Review MCU" },
    ]);
  });

  it("route satu tingkat tampil sebagai halaman aktif", () => {
    expect(buildBreadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }]);
  });

  it("segmen tak dikenal di-humanize", () => {
    const items = buildBreadcrumbs("/foo/bar-baz");
    expect(items[items.length - 1].label).toBe("Bar Baz");
  });
});

// ---------------------------------------------------------------------------
// Regression: cakupan test navigasi yang sudah ada sebelum Tahap 2 dirapikan.
// Satu perilaku sengaja berubah (getNavigation(null) → [] karena /demo kini
// internal) dan diuji ulang sesuai keputusan resmi tersebut.
// ---------------------------------------------------------------------------
describe("regression navigasi (dipertahankan)", () => {
  it("ROUTE_LABELS dipakai untuk route kunjungan bertingkat", () => {
    expect(buildBreadcrumbs("/visits/new")).toEqual([
      { label: "Kunjungan Klinik", href: "/visits" },
      { label: "Kunjungan Baru" },
    ]);
  });

  it("humanize segmen bertingkat", () => {
    expect(buildBreadcrumbs("/unknown-thing/detail")).toEqual([
      { label: "Unknown Thing", href: "/unknown-thing" },
      { label: "Detail" },
    ]);
  });

  it("item breadcrumb terakhir tidak punya href (halaman aktif)", () => {
    const items = buildBreadcrumbs("/mcu/review");
    expect(items[items.length - 1].href).toBeUndefined();
  });

  it("isNavActive: parent, exact, dan bukan prefix salah", () => {
    expect(isNavActive("/mcu", "/mcu")).toBe(true);
    expect(isNavActive("/mcu/review", "/mcu")).toBe(true);
    expect(isNavActive("/mcux", "/mcu")).toBe(false);
    expect(isNavActive("/", "/mcu")).toBe(false);
  });

  it("isNavActive: end mode hanya persis", () => {
    expect(isNavActive("/dashboard", "/dashboard", true)).toBe(true);
    expect(isNavActive("/dashboard/", "/dashboard", true)).toBe(false);
    expect(isNavActive("/mcu/review", "/mcu", true)).toBe(false);
  });

  it("isNavActive: /dashboard hanya aktif persis walau tanpa end", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/dashboard/anything", "/dashboard")).toBe(false);
  });

  it("role kosong → tidak ada item (KEPUTUSAN BARU: /demo internal, bukan publik)", () => {
    expect(getNavigation(null)).toEqual([]);
    expect(getNavigation(undefined)).toEqual([]);
    // registry tetap utuh; hanya filternya yang membedakan
    expect(NAVIGATION_ITEMS.length).toBeGreaterThan(10);
  });

  it("admin tidak mendapat review-mcu (khusus dokter-oh)", () => {
    expect(getNavigation("admin").some((i) => i.href === "/mcu/review")).toBe(false);
  });

  it("apoteker: dispensing ada, register-patient tidak", () => {
    const nav = getNavigation("apoteker");
    expect(nav.some((i) => i.href === "/medicine/dispense")).toBe(true);
    expect(nav.some((i) => i.href === "/visits/new")).toBe(false);
  });

  it("pekerja: item tanpa izin hilang, Lab & Radiologi tidak tampil", () => {
    const nav = getNavigation("pekerja");
    expect(nav.some((i) => i.href === "/users")).toBe(false);
    expect(nav.some((i) => i.href === "/lab")).toBe(false);
  });

  it("hr: register-patient & users hilang, employees ada", () => {
    const nav = getNavigation("hr");
    expect(nav.some((i) => i.href === "/visits/new")).toBe(false);
    expect(nav.some((i) => i.href === "/users")).toBe(false);
    expect(nav.some((i) => i.href === "/employees")).toBe(true);
  });

  it("Lab & Radiologi menunjuk /lab dengan permission input-lab-result", () => {
    const lab = NAVIGATION_ITEMS.find((i) => i.href === "/lab");
    expect(lab).toBeDefined();
    expect(lab?.disabled).toBeUndefined();
    expect(lab?.permission).toBe("input-lab-result");
  });

  it("resolveLoginRedirect: path non-internal ditolak", () => {
    expect(resolveLoginRedirect("people")).toBe("/dashboard");
    expect(resolveLoginRedirect("https://evil.example")).toBe("/dashboard");
    expect(resolveLoginRedirect("//evil.example")).toBe("/dashboard");
    expect(resolveLoginRedirect("/\\evil.example")).toBe("/dashboard");
  });
});
