import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/types";
import { installBrowserStubs, mockFetch, envelope, pathOf } from "./helpers";

installBrowserStubs();

/**
 * Fase 3 — bukti lapisan frontend untuk 3 kriteria kritis pharmacy:
 *   1. Dispensing tidak terjadi dua kali.
 *   2. Aksi lintas site ditolak (dan request-nya tidak pernah dikirim).
 *   3. Retur obat mengubah stock ledger.
 *
 * Kriteria lain (SOAP tersimpan, record terkunci, role non-apoteker) diuji
 * oleh `module-endpoints.test.ts`, `actions.test.ts`, `navigation.test.ts`,
 * dan `route-guard.test.ts`.
 */
describe("Fase 3 — DispensingGuard: dispensing tidak terjadi dua kali", () => {
  it("menolak permintaan kedua untuk resep yang sama (in-flight)", async () => {
    const { DispensingGuard } = await import("@/lib/services/pharmacy.service");
    const guard = new DispensingGuard();

    expect(guard.begin("rx-1")).toBe(true);
    expect(guard.isInProgress("rx-1")).toBe(true);
    // Klik kedua saat request pertama masih berjalan → tidak ada request baru.
    expect(guard.begin("rx-1")).toBe(false);
    expect(guard.isDispensed("rx-1")).toBe(false);
  });

  it("mengunci resep selamanya setelah dispensing selesai", async () => {
    const { DispensingGuard } = await import("@/lib/services/pharmacy.service");
    const guard = new DispensingGuard();

    expect(guard.begin("rx-1")).toBe(true);
    guard.commit("rx-1");
    expect(guard.isDispensed("rx-1")).toBe(true);
    expect(guard.isInProgress("rx-1")).toBe(false);
    // Resep lain tetap diproses normal.
    expect(guard.begin("rx-1")).toBe(false);
    expect(guard.begin("rx-2")).toBe(true);
  });

  it("rollback membuka kembali resep yang gagal agar bisa dicoba ulang", async () => {
    const { DispensingGuard } = await import("@/lib/services/pharmacy.service");
    const guard = new DispensingGuard();

    expect(guard.begin("rx-1")).toBe(true);
    guard.rollback("rx-1");
    expect(guard.isInProgress("rx-1")).toBe(false);
    expect(guard.isDispensed("rx-1")).toBe(false);
    expect(guard.begin("rx-1")).toBe(true);
  });

  it("id kosong selalu ditolak", async () => {
    const { DispensingGuard } = await import("@/lib/services/pharmacy.service");
    expect(new DispensingGuard().begin("")).toBe(false);
  });
});

describe("Fase 3 — cross-site guard: aksi lintas site ditolak", () => {
  const siteScope = {
    unrestricted: false,
    siteIds: ["site-ho"],
    siteNames: ["Head Office Jakarta"],
  };

  it("menolak target site di luar cakupan user", async () => {
    const { assertPharmacySite, CrossSiteActionError } = await import(
      "@/lib/services/pharmacy.service"
    );
    expect(() =>
      assertPharmacySite(siteScope, { siteId: "site-plant", siteName: "Plant 01" })
    ).toThrow(CrossSiteActionError);
  });

  it("mengizinkan site dalam cakupan (cocok via id ATAU nama)", async () => {
    const { assertPharmacySite } = await import("@/lib/services/pharmacy.service");
    expect(() => assertPharmacySite(siteScope, { siteId: "site-ho" })).not.toThrow();
    expect(() =>
      assertPharmacySite(siteScope, { siteId: "lain", siteName: "head office jakarta" })
    ).not.toThrow();
  });

  it("role GLOBAL (unrestricted) lolos untuk site mana pun", async () => {
    const { assertPharmacySite } = await import("@/lib/services/pharmacy.service");
    expect(() =>
      assertPharmacySite(
        { unrestricted: true, siteIds: [], siteNames: [] },
        { siteId: "site-plant", siteName: "Plant 01" }
      )
    ).not.toThrow();
  });

  it("fail-closed: tanpa site dalam cakupan, semua aksi ditolak", async () => {
    const { assertPharmacySite, CrossSiteActionError } = await import(
      "@/lib/services/pharmacy.service"
    );
    expect(() =>
      assertPharmacySite(
        { unrestricted: false, siteIds: [], siteNames: [] },
        { siteId: "site-ho", siteName: "Head Office Jakarta" }
      )
    ).toThrow(CrossSiteActionError);
  });

  it("pesan error menyebut target dan cakupan yang diizinkan", async () => {
    const { assertPharmacySite } = await import("@/lib/services/pharmacy.service");
    try {
      assertPharmacySite(siteScope, { siteId: "site-plant", siteName: "Plant 01" });
      throw new Error("seharusnya melempar");
    } catch (e) {
      expect((e as Error).name).toBe("CrossSiteActionError");
      expect((e as Error).message).toContain("Plant 01");
      expect((e as Error).message).toContain("Head Office Jakarta");
    }
  });

  it("dispense/return lintas site tidak pernah mengirim request ke backend", async () => {
    const { clearPharmacySiteScopeCache, pharmacyService, CrossSiteActionError } = await import(
      "@/lib/services/pharmacy.service"
    );
    clearPharmacySiteScopeCache();
    const calls = mockFetch((req) => {
      // User site-scoped tidak berhak membaca registry user → 403,
      // lalu inventory juga kosong → cakupan kosong (fail-closed).
      if (req.url.includes("/iam/users")) return { status: 403, body: envelope(null) };
      return { body: envelope([]) };
    });

    const target = { siteId: "site-plant", siteName: "Plant 01" };
    await expect(
      pharmacyService.dispense("rx-1", [{ stockBatchId: "b1", quantity: 5 }], target)
    ).rejects.toBeInstanceOf(CrossSiteActionError);
    await expect(
      pharmacyService.returnMedication("d1", "b1", 1, "rusak", target)
    ).rejects.toBeInstanceOf(CrossSiteActionError);
    await expect(
      pharmacyService.recommendBatches("med-1", "site-plant", 5, target)
    ).rejects.toBeInstanceOf(CrossSiteActionError);

    const writes = calls.filter(
      (c) =>
        c.method === "POST" &&
        ["/api/v1/pharmacy/dispensing", "/api/v1/pharmacy/returns"].some((p) =>
          pathOf(c.url).startsWith(p)
        )
    );
    expect(writes).toHaveLength(0);
    clearPharmacySiteScopeCache();
  });
});

describe("Fase 3 — stock ledger: retur mengubah stok", () => {
  function inv(over: {
    id?: string;
    currentStock?: number;
    medicationCode?: string;
    genericName?: string;
    siteName?: string;
  } = {}) {
    return {
      id: over.id ?? "inv-1",
      medicationCode: over.medicationCode ?? "MED-PCM-500",
      genericName: over.genericName ?? "Parasetamol",
      siteName: over.siteName ?? "Head Office Jakarta",
      currentStock: over.currentStock ?? 100,
      minimumStock: 10,
      isLowStock: false,
      activeBatchesCount: 2,
      nearestExpiryDate: "2027-01-31",
    };
  }

  it("retur menambah stok (delta positif)", async () => {
    const { diffStockLedger } = await import("@/lib/services/pharmacy.service");
    const before = [inv({ currentStock: 100 })];
    const after = [inv({ currentStock: 105 })];

    const entries = diffStockLedger(before, after, "RETURN");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      medicationCode: "MED-PCM-500",
      before: 100,
      after: 105,
      delta: 5,
      movement: "RETURN",
    });
  });

  it("dispensing mengurangi stok (delta negatif)", async () => {
    const { diffStockLedger } = await import("@/lib/services/pharmacy.service");
    const entries = diffStockLedger(
      [inv({ currentStock: 100 })],
      [inv({ currentStock: 90 })],
      "DISPENSING"
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].delta).toBe(-10);
    expect(entries[0].movement).toBe("DISPENSING");
  });

  it("tidak mengeluarkan entri bila stok tidak berubah", async () => {
    const { diffStockLedger } = await import("@/lib/services/pharmacy.service");
    expect(diffStockLedger([inv()], [inv()], "RETURN")).toHaveLength(0);
  });

  it("hanya membandingkan item yang ada di kedua snapshot", async () => {
    const { diffStockLedger } = await import("@/lib/services/pharmacy.service");
    const entries = diffStockLedger(
      [inv({ id: "inv-1" }), inv({ id: "inv-hilang" })],
      [inv({ id: "inv-1", currentStock: 120 })],
      "RETURN"
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].after).toBe(120);
  });
});

describe("Fase 3 — RBAC: role non-apoteker tidak punya aksi pharmacy", () => {
  it("hanya apoteker yang boleh dispensing & menerima stok", async () => {
    const { canPerform } = await import("@/lib/actions");
    const pharmacyActions = ["pharmacy.dispense", "pharmacy.receive-stock"] as const;

    // System Administrator (admin) tidak punya akses farmasi (proposal:
    // "tidak punya akses data klinis"); admin-klinik juga tidak. Jadi hanya
    // apoteker yang berhak atas dispensing & penerimaan stok.
    const allowed: Role[] = ["apoteker"];
    const denied: Role[] = [
      "hr",
      "dokter-oh",
      "dokter-klinik",
      "perawat",
      "lab",
      "hse",
      "manajemen",
      "pekerja",
    ];

    for (const role of allowed) {
      for (const action of pharmacyActions) {
        expect(canPerform(role, action), `${role} → ${action}`).toBe(true);
      }
    }
    for (const role of denied) {
      for (const action of pharmacyActions) {
        expect(canPerform(role, action), `${role} → ${action}`).toBe(false);
      }
    }
  });
});
