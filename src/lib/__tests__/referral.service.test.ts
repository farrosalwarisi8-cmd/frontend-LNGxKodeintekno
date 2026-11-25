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

describe("referralService", () => {
  beforeEach(() => {
    useStore.setState({ referrals: [], currentUserId: null });
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
