import { describe, it, expect } from "vitest";
import {
  ROLE_TASK_PROFILES,
  getRoleDashboard,
  getRoleTasks,
  getWorkerHomeLinks,
  type DashboardTileKey,
} from "../role-tasks";
import { ROLE_PERMISSIONS, can } from "../../../../lib/rbac";
import { ROUTE_LABELS } from "../../../lib/navigation";
import type { Role } from "../../../../lib/types";

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];
const TILE_KEYS: DashboardTileKey[] = [
  "employees",
  "pendingMcu",
  "mcuDueSoon",
  "visitsToday",
  "queueWaiting",
  "validCerts",
  "fitToWork",
  "fitWithRestriction",
  "restricted",
  "lowStock",
  "pendingPrescriptions",
  "myFitStatus",
  "myNextMcu",
];

describe("ROLE_TASK_PROFILES", () => {
  it("covers every role defined in the permission registry", () => {
    for (const role of ROLES) {
      expect(ROLE_TASK_PROFILES[role], `profil dashboard untuk ${role} hilang`).toBeDefined();
    }
  });

  it("gives every role at least three usable quick actions", () => {
    for (const role of ROLES) {
      const tasks = getRoleTasks(role);
      expect(tasks.length, `${role} hanya punya ${tasks.length} tindakan`).toBeGreaterThanOrEqual(3);
    }
  });

  it("never lists a task the role could not perform", () => {
    for (const role of ROLES) {
      for (const task of getRoleTasks(role)) {
        if (task.permission) {
          expect(
            can(role, task.permission),
            `${role} tidak punya permission ${task.permission} (${task.label})`
          ).toBe(true);
        }
      }
    }
  });

  it("only links to known routes", () => {
    for (const role of ROLES) {
      for (const task of ROLE_TASK_PROFILES[role].tasks) {
        const path = task.href.split("?")[0];
        expect(ROUTE_LABELS[path], `${task.href} tidak ada di ROUTE_LABELS`).toBeDefined();
      }
    }
  });

  it("keeps every href unique inside a profile", () => {
    for (const role of ROLES) {
      const hrefs = ROLE_TASK_PROFILES[role].tasks.map((t) => t.href);
      expect(new Set(hrefs).size, `href duplikat pada ${role}`).toBe(hrefs.length);
    }
  });

  it("uses only known tile keys and lists at least four of them", () => {
    for (const role of ROLES) {
      const { tiles } = ROLE_TASK_PROFILES[role];
      expect(tiles.length).toBeGreaterThanOrEqual(4);
      for (const tile of tiles) expect(TILE_KEYS).toContain(tile);
    }
  });
});

describe("getRoleDashboard", () => {
  it("returns an empty task list when there is no role", () => {
    const profile = getRoleDashboard(null);
    expect(profile.tasks).toEqual([]);
    expect(getRoleTasks(null)).toEqual([]);
    expect(getRoleTasks(undefined)).toEqual([]);
  });

  it("marks only the worker profile as compact", () => {
    expect(getRoleDashboard("pekerja").compact).toBe(true);
    for (const role of ROLES.filter((r) => r !== "pekerja")) {
      expect(ROLE_TASK_PROFILES[role].compact ?? false).toBe(false);
    }
  });

  it("gives the clinic intake roles the registration and queue actions first", () => {
    for (const role of ["admin-klinik", "perawat"] as Role[]) {
      const tasks = getRoleTasks(role);
      expect(tasks[0].href).toBe("/visits/new");
      expect(tasks[1].href).toBe("/visits/queue");
    }
  });

  it("gives the pharmacist dispensing first", () => {
    expect(getRoleTasks("apoteker")[0].href).toBe("/medicine/dispense");
  });

  it("puts SOAP first for doctors", () => {
    expect(getRoleTasks("dokter-oh")[0].href).toBe("/medical-records");
    expect(getRoleTasks("dokter-klinik")[0].href).toBe("/medical-records");
  });

  it("points HR and HSE at the due-soon health status filter", () => {
    expect(getRoleTasks("hr")[0].href).toBe("/health-status?filter=due-soon");
    expect(getRoleTasks("hse")[0].href).toBe("/health-status");
  });
});

describe("getWorkerHomeLinks", () => {
  it("keeps the worker home inside /my/*", () => {
    const links = getWorkerHomeLinks();
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) expect(link.href.startsWith("/my/")).toBe(true);
  });
});
