import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { can, canAny, type Permission } from "../../../lib/rbac";
import type { Role } from "../../../lib/types";
import { getNavigation } from "../navigation";
import { canSwitchSiteScope, dataScopeForRole } from "../data-scope";
import { SidebarNav } from "../../../components/sidebar-nav";

const NAV_CASES: Array<{
  role: Role;
  label: string;
  mustHave: string[];
  mustNotHave: string[];
}> = [
  {
    role: "admin-klinik",
    label: "Admin Klinik",
    mustHave: ["/dashboard", "/people", "/visits", "/visits/new", "/visits/queue"],
    mustNotHave: ["/users", "/master-data", "/mcu", "/medical-records", "/medicine"],
  },
  {
    role: "hr",
    label: "HR/PIC",
    mustHave: ["/dashboard", "/people", "/employees", "/health-status", "/reports"],
    mustNotHave: ["/users", "/master-data", "/mcu", "/visits", "/audit-logs"],
  },
  {
    role: "admin",
    label: "System Administrator",
    mustHave: ["/dashboard", "/users", "/master-data", "/audit-logs", "/reports"],
    mustNotHave: ["/people", "/employees", "/mcu", "/visits", "/medicine", "/medical-records"],
  },
  {
    role: "pekerja",
    label: "Pekerja",
    mustHave: ["/dashboard", "/health-status", "/reports"],
    mustNotHave: ["/people", "/employees", "/users", "/medicine", "/visits/new"],
  },
];

function renderSidebar(role: Role): string {
  return renderToStaticMarkup(
    <SidebarNav items={getNavigation(role)} pathname="/dashboard" />
  );
}

describe("can() — matriks permission per role", () => {
  it("System Administrator tidak memiliki permission klinis maupun data pekerja", () => {
    const clinical: Permission[] = [
      "view-mcu",
      "view-visits",
      "view-clinical-notes",
      "view-diagnosis",
      "manage-stock",
      "dispense-medicine",
      "manage-employees",
    ];
    expect(clinical.some((p) => can("admin", p))).toBe(false);
    expect(can("admin", "manage-users")).toBe(true);
    expect(can("admin", "view-audit-logs")).toBe(true);
  });

  it("HR/PIC hanya mengelola pekerja & kepatuhan, tanpa detail medis", () => {
    expect(can("hr", "manage-employees")).toBe(true);
    expect(can("hr", "view-health-status")).toBe(true);
    expect(can("hr", "view-diagnosis")).toBe(false);
    expect(can("hr", "view-clinical-notes")).toBe(false);
    expect(can("hr", "manage-users")).toBe(false);
  });

  it("Pekerja hanya mendapat izin baca pribadi", () => {
    expect(can("pekerja", "view-profile")).toBe(true);
    expect(can("pekerja", "view-mcu")).toBe(true);
    expect(canAny("pekerja", ["manage-employees", "view-visits", "export-reports"])).toBe(false);
  });

  it("Dokter OH memegang kewenangan FTW & sertifikat", () => {
    expect(can("dokter-oh", "set-ftw")).toBe(true);
    expect(can("dokter-oh", "issue-certificate")).toBe(true);
    expect(can("dokter-klinik", "issue-certificate")).toBe(false);
  });
});

describe("filter navigasi per role", () => {
  for (const testCase of NAV_CASES) {
    it(`${testCase.label} melihat menu sesuai matriks`, () => {
      const hrefs = getNavigation(testCase.role).map((item) => item.href);
      for (const href of testCase.mustHave) expect(hrefs).toContain(href);
      for (const href of testCase.mustNotHave) expect(hrefs).not.toContain(href);
    });
  }
});

describe("SidebarNav — rendering per role", () => {
  for (const testCase of NAV_CASES) {
    it(`sidebar ${testCase.label} dirender dari konfigurasi + permission`, () => {
      const html = renderSidebar(testCase.role);
      expect(html).toContain('aria-label="Navigasi utama"');
      expect(html).toContain("Dasbor");
      for (const href of testCase.mustHave) {
        expect(html).toContain(`href="${href}"`);
      }
      for (const href of testCase.mustNotHave) {
        expect(html).not.toContain(`href="${href}"`);
      }
    });
  }

  it("mode ciut memberi tooltip (title + aria-label) pada setiap tautan", () => {
    const html = renderToStaticMarkup(
      <SidebarNav items={getNavigation("hr")} pathname="/dashboard" collapsed />
    );
    expect(html).toContain('title="Dasbor"');
    expect(html).toContain('aria-label="Direktori Pekerja"');
  });
});

describe("data scope per role", () => {
  it("pekerja bersifat PERSONAL dan tidak punya pemilih site", () => {
    expect(dataScopeForRole("pekerja")).toBe("PERSONAL");
    expect(canSwitchSiteScope("pekerja")).toBe(false);
  });

  it("hanya GLOBAL/ORG yang boleh memilih site", () => {
    expect(canSwitchSiteScope("admin")).toBe(true);
    expect(canSwitchSiteScope("manajemen")).toBe(true);
    expect(canSwitchSiteScope("hr")).toBe(true);
    expect(canSwitchSiteScope("hse")).toBe(true);
    expect(canSwitchSiteScope("perawat")).toBe(false);
    expect(canSwitchSiteScope("admin-klinik")).toBe(false);
  });
});
