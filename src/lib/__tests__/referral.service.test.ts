import { beforeEach, describe, expect, it } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "document", { value: { cookie: "" } });

import { useStore } from "../../../lib/store";
import { referralService } from "@/lib/services/referral.service";
import type { ClinicVisit } from "../../../lib/types";

/** Fixture LOKAL — tidak lagi memakai data seed global store. */
function testVisit(id: string, visitNumber: string): ClinicVisit {
  return {
    id,
    visitNumber,
    queueNumber: 1,
    employeeId: "e-test-1",
    locationId: "l-test-1",
    date: "2026-11-25",
    time: "09:00",
    chiefComplaint: "Keluhan uji",
    initialExam: "",
    diagnosisIds: [],
    diagnosisNote: "",
    treatment: "",
    doctorNote: "",
    status: "In Queue",
    createdAt: "2026-11-25T09:00:00.000Z",
  };
}

describe("referralService", () => {
  beforeEach(() => {
    useStore.setState({
      referrals: [],
      currentUserId: null,
      visits: [testVisit("v-test-1", "VIS-9001"), testVisit("v-test-2", "VIS-9002")],
    });
  });

  it("mencatat rujukan dan menandai kunjungan sebagai Referred", () => {
    const visit = useStore.getState().visits[0];
    const id = referralService.create({
      visitId: visit.id,
      destination: "  RS Umum Daerah  ",
      reason: "  Perlu CT scan  ",
      referralDate: "2026-11-25",
    });

    const created = referralService.listForVisit(visit.id);
    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(id);
    expect(created[0].destination).toBe("RS Umum Daerah");
    expect(created[0].reason).toBe("Perlu CT scan");
    expect(created[0].status).toBe("ISSUED");

    const updatedVisit = useStore.getState().visits.find((v) => v.id === visit.id);
    expect(updatedVisit?.status).toBe("Referred");
    expect(updatedVisit?.referralFacility).toBe("RS Umum Daerah");
    expect(updatedVisit?.referralReason).toBe("Perlu CT scan");
  });

  it("memisahkan rujukan per kunjungan", () => {
    const [first, second] = useStore.getState().visits;

    referralService.create({
      visitId: first.id,
      destination: "RS A",
      reason: "Alasan A",
      referralDate: "2026-11-25",
    });
    referralService.create({
      visitId: second.id,
      destination: "RS B",
      reason: "Alasan B",
      referralDate: "2026-11-25",
    });

    expect(referralService.listForVisit(first.id)).toHaveLength(1);
    expect(referralService.listForVisit(second.id)[0].destination).toBe("RS B");
    expect(referralService.list()).toHaveLength(2);
  });
});
