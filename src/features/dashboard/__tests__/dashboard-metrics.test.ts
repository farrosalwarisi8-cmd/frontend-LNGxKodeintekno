import { describe, it, expect } from "vitest";
import {
  MCU_DUE_SOON_DAYS,
  buildTiles,
  computeDashboardMetrics,
  isDueSoon,
  mergePendingPrescriptions,
  openVisits,
  type DashboardMetricsInput,
} from "../dashboard-metrics";
import type {
  ClinicVisit,
  Employee,
  HealthCertificate,
  MCU,
  Medicine,
  StockBatch,
  WorkHealthStatus,
} from "../../../../lib/types";

const TODAY = "2026-10-16";

function employee(id: string, name: string): Employee {
  return {
    id,
    employeeId: `EMP-${id}`,
    mrn: `MRN-${id}`,
    fullName: name,
    nationalId: "3174010101900001",
    dateOfBirth: "1990-01-01",
    gender: "Male",
    companyId: "company-1",
    departmentId: "dept-1",
    jobTitle: "Operator",
    locationId: "loc-1",
    startDate: "2020-01-01",
    status: "Active",
    phone: "",
    email: `${id}@example.com`,
    employmentHistory: [],
    consentGiven: true,
    documents: [],
  };
}

function visit(id: string, status: ClinicVisit["status"], date = TODAY): ClinicVisit {
  return {
    id,
    visitNumber: `V-${id}`,
    queueNumber: 1,
    employeeId: "e1",
    locationId: "loc-1",
    date,
    time: "09:00",
    chiefComplaint: "Demam",
    initialExam: "",
    diagnosisIds: [],
    diagnosisNote: "",
    treatment: "",
    doctorNote: "",
    status,
    createdAt: `${date}T09:00:00Z`,
  };
}

function ftw(id: string, status: WorkHealthStatus["status"], validUntil: string, restriction?: string): WorkHealthStatus {
  return {
    id,
    employeeId: id,
    status,
    validFrom: "2025-01-01",
    validUntil,
    restriction,
  } as WorkHealthStatus;
}

const base: DashboardMetricsInput = {
  employees: [employee("e1", "Budi"), employee("e2", "Sari")],
  mcus: [
    { id: "m1", status: "Submitted" } as MCU,
    { id: "m2", status: "Approved" } as MCU,
  ],
  visits: [
    visit("v1", "In Queue"),
    visit("v2", "In Consultation"),
    visit("v3", "Completed"),
    visit("v4", "In Queue", "2026-10-15"),
  ],
  certificates: [
    { id: "c1", status: "valid" } as HealthCertificate,
    { id: "c2", status: "expired" } as HealthCertificate,
  ],
  workHealthStatus: [
    ftw("e1", "Fit to Work", "2026-12-01"),
    ftw("e2", "Fit with Restriction", "2026-10-20", "Tanpa kerja di ketinggian"),
    ftw("e3", "Fit to Work", "2026-01-01"),
  ],
  medicines: [
    { id: "med1", minStock: 10 } as Medicine,
    { id: "med2", minStock: 5 } as Medicine,
  ],
  stockBatches: [
    { id: "b1", medicineId: "med1", quantity: 4 } as StockBatch,
    { id: "b2", medicineId: "med2", quantity: 50 } as StockBatch,
  ],
  today: TODAY,
};

describe("isDueSoon", () => {
  it("treats already-expired dates as due", () => {
    expect(isDueSoon("2026-01-01", TODAY, MCU_DUE_SOON_DAYS)).toBe(true);
  });

  it("counts dates inside the window", () => {
    expect(isDueSoon("2026-10-20", TODAY, MCU_DUE_SOON_DAYS)).toBe(true);
  });

  it("ignores dates beyond the window", () => {
    expect(isDueSoon("2026-12-01", TODAY, MCU_DUE_SOON_DAYS)).toBe(false);
  });

  it("is false for missing or invalid values", () => {
    expect(isDueSoon(undefined, TODAY, 30)).toBe(false);
    expect(isDueSoon("bukan-tanggal", TODAY, 30)).toBe(false);
  });
});

describe("computeDashboardMetrics", () => {
  it("counts the underlying data honestly", () => {
    const m = computeDashboardMetrics(base);
    expect(m.employees).toBe(2);
    expect(m.pendingMcu).toBe(1);
    expect(m.visitsToday).toBe(3);
    expect(m.queueWaiting).toBe(2);
    expect(m.validCerts).toBe(1);
    expect(m.fitToWork).toBe(2);
    expect(m.fitWithRestriction).toBe(1);
    expect(m.restricted).toBe(1);
    expect(m.lowStock).toBe(1);
  });

  it("counts MCU due soon including overdue records", () => {
    // e2 (2026-10-20, dalam 30 hari) + e3 (2026-01-01, sudah lewat)
    expect(computeDashboardMetrics(base).mcuDueSoon).toBe(2);
  });

  it("shows a dash for personal tiles when the account has no employee record", () => {
    const m = computeDashboardMetrics(base);
    expect(m.myFitStatus).toBe("—");
    expect(m.myNextMcu).toBe("—");
  });

  it("resolves personal tiles from the linked employee", () => {
    const m = computeDashboardMetrics({ ...base, currentEmployeeId: "e2" });
    expect(m.myFitStatus).toBe("Fit with Restriction");
    expect(m.myNextMcu).toBe("2026-10-20");
  });

  it("returns zeroes (not fake numbers) when the backend returned nothing", () => {
    const m = computeDashboardMetrics({
      employees: [],
      mcus: [],
      visits: [],
      certificates: [],
      workHealthStatus: [],
      medicines: [],
      stockBatches: [],
      today: TODAY,
    });
    expect(m.employees).toBe(0);
    expect(m.visitsToday).toBe(0);
    expect(m.lowStock).toBe(0);
    expect(m.mcuDueSoon).toBe(0);
  });

  it("accepts a custom due-soon window", () => {
    const m = computeDashboardMetrics({ ...base, dueSoonDays: 0 });
    expect(m.mcuDueSoon).toBe(1); // hanya yang sudah lewat
  });
});

describe("mergePendingPrescriptions", () => {
  it("uses the backend count once it arrives", () => {
    const m = mergePendingPrescriptions(computeDashboardMetrics(base), 4);
    expect(m.pendingPrescriptions).toBe(4);
  });

  it("shows a dash while the count is unknown", () => {
    const m = mergePendingPrescriptions(computeDashboardMetrics(base), null);
    expect(m.pendingPrescriptions).toBe("—");
  });
});

describe("buildTiles", () => {
  it("keeps the requested order and attaches metadata", () => {
    const metrics = computeDashboardMetrics(base);
    const tiles = buildTiles(["queueWaiting", "pendingMcu"], metrics);
    expect(tiles.map((t) => t.key)).toEqual(["queueWaiting", "pendingMcu"]);
    expect(tiles[0].label).toBe("Antrean menunggu");
    expect(tiles[0].href).toBe("/visits/queue");
    expect(tiles[1].value).toBe(1);
  });
});

describe("openVisits", () => {
  it("drops finished visits", () => {
    const open = openVisits(base.visits);
    expect(open.map((v) => v.id)).toEqual(["v1", "v2", "v4"]);
  });
});
