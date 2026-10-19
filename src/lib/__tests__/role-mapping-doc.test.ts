import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../../../lib/rbac";
import { BACKEND_ROLE_MAP, FRONTEND_ROLE_TO_BACKEND } from "@/lib/services/auth.service";
import { DEMO_ROLE_LABELS, DEMO_ROLE_TO_ROLE } from "@/lib/demo-role-map";
import { NAVIGATION_ITEMS } from "@/lib/navigation";
import { ROUTE_PERMISSIONS } from "@/components/route-guard";
import {
  buildRoleMappingMarkdown,
  collectRegistry,
} from "../../../scripts/generate-role-matrix.mjs";

/**
 * A1 (Tugas 4) — ROLE_MAPPING.md harus selalu sesuai dengan kode.
 *
 * Dua lapis pemeriksaan:
 *  1. Parser pada `scripts/generate-role-matrix.mjs` harus menghasilkan data
 *     yang PERSIS sama dengan modul aslinya (akurasi parser).
 *  2. Isi file ROLE_MAPPING.md harus sama persis dengan hasil generator
 *     (dokumen tidak boleh menyimpang dari kode).
 */

const ROOT = process.cwd();
const DOC_PATH = path.join(ROOT, "ROLE_MAPPING.md");

describe("generator ROLE_MAPPING.md", () => {
  it("parser menghasilkan data yang sama dengan modul asli", () => {
    const registry = collectRegistry();

    expect(registry.rolePermissions).toEqual(ROLE_PERMISSIONS);
    expect(registry.allPermissions).toEqual(ALL_PERMISSIONS);
    expect(registry.backendRoleMap).toEqual(BACKEND_ROLE_MAP);
    expect(registry.frontendToBackend).toEqual(FRONTEND_ROLE_TO_BACKEND);
    expect(registry.demoRoleToRole).toEqual(DEMO_ROLE_TO_ROLE);
    expect(registry.demoRoleLabels).toEqual(DEMO_ROLE_LABELS);
    expect(registry.navigationItems).toEqual(NAVIGATION_ITEMS);
    expect(registry.routePermissions.length).toBe(ROUTE_PERMISSIONS.length);
    registry.routePermissions.forEach(
      (rule: { permission: string; pattern: RegExp }, index: number) => {
        expect(rule.permission).toBe(ROUTE_PERMISSIONS[index].permission);
        expect(rule.pattern.source).toBe(ROUTE_PERMISSIONS[index].pattern.source);
      }
    );
  });

  it("ROLE_MAPPING.md ada dan sama dengan hasil generator", () => {
    expect(fs.existsSync(DOC_PATH), "ROLE_MAPPING.md harus ada").toBe(true);
    const onDisk = fs.readFileSync(DOC_PATH, "utf8");
    const generated = buildRoleMappingMarkdown();
    expect(
      onDisk,
      "ROLE_MAPPING.md tidak sinkron dengan kode. Jalankan: node scripts/generate-role-matrix.mjs"
    ).toBe(generated);
  });

  it("dokumen memuat setiap role dan setiap permission", () => {
    const onDisk = fs.readFileSync(DOC_PATH, "utf8");
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      expect(onDisk, role).toContain(`| \`${role}\` |`);
    }
    for (const permission of ALL_PERMISSIONS) {
      expect(onDisk, permission).toContain(`| \`${permission}\` |`);
    }
  });

  it("dokumen mencerminkan aturan proposal untuk admin, hr, dan lab", () => {
    const onDisk = fs.readFileSync(DOC_PATH, "utf8");
    const rows = onDisk.split("\n");
    const cells = (row: string) => row.split("|").map((c) => c.trim());
    const header = cells(rows.find((line) => line.startsWith("| Permission |")) as string);
    const rowOf = (permission: string) =>
      cells(rows.find((line) => line.startsWith(`| \`${permission}\` |`)) as string);
    const valueFor = (permission: string, role: string) =>
      rowOf(permission)[header.indexOf(role)];

    // admin: tanpa akses MCU/klinis, tetapi tetap managing user.
    expect(valueFor("view-mcu", "admin")).toBe("—");
    expect(valueFor("view-clinical-notes", "admin")).toBe("—");
    expect(valueFor("dispense-medicine", "admin")).toBe("—");
    expect(valueFor("manage-users", "admin")).toBe("✓");

    // hr: tanpa kelola user/master data dan tanpa MCU penuh.
    expect(valueFor("manage-users", "hr")).toBe("—");
    expect(valueFor("manage-master-data", "hr")).toBe("—");
    expect(valueFor("view-mcu", "hr")).toBe("—");
    expect(valueFor("view-health-status", "hr")).toBe("✓");

    // lab: tanpa akses MCU penuh, tetap input hasil lab.
    expect(valueFor("view-mcu", "lab")).toBe("—");
    expect(valueFor("input-lab-result", "lab")).toBe("✓");
  });
});
