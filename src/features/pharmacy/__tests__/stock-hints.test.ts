import { describe, it, expect } from "vitest";
import { FEFO_WARN_DAYS, buildStockHints, summarizeDispenseWarnings } from "../stock-hints";
import type { BackendInventoryItem } from "../../../lib/services/pharmacy.service";

const TODAY = "2026-10-16";

function inventory(
  genericName: string,
  currentStock: number,
  extra: Partial<BackendInventoryItem> = {}
): BackendInventoryItem {
  return {
    id: `inv-${genericName}`,
    medicationCode: `MED-${genericName}`,
    genericName,
    siteName: "HQ",
    currentStock,
    minimumStock: 10,
    isLowStock: currentStock < 10,
    activeBatchesCount: 1,
    nearestExpiryDate: null,
    ...extra,
  };
}

describe("buildStockHints", () => {
  it("matches prescription items to inventory by generic name (case-insensitive)", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Paracetamol", quantity: 5 }],
      [inventory("paracetamol", 50)],
      { today: TODAY }
    );
    expect(hints[0].currentStock).toBe(50);
    expect(hints[0].shortfall).toBe(0);
  });

  it("flags a stock shortfall before the request is sent to the backend", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Amoxicillin", quantity: 30 }],
      [inventory("Amoxicillin", 12)],
      { today: TODAY }
    );
    expect(hints[0].shortfall).toBe(18);
    expect(summarizeDispenseWarnings(hints).blocked).toBe(true);
  });

  it("reports unknown stock as null instead of pretending it is zero", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Obat Baru", quantity: 3 }],
      [inventory("Amoxicillin", 12)],
      { today: TODAY }
    );
    expect(hints[0].currentStock).toBeNull();
    expect(hints[0].shortfall).toBe(0);
    expect(summarizeDispenseWarnings(hints).blocked).toBe(false);
  });

  it("flags batches expiring inside the FEFO window", () => {
    const soon = buildStockHints(
      [{ itemId: "i1", name: "Amoxicillin", quantity: 1 }],
      [inventory("Amoxicillin", 40, { nearestExpiryDate: "2026-11-01" })],
      { today: TODAY }
    );
    expect(soon[0].expiresSoon).toBe(true);

    const later = buildStockHints(
      [{ itemId: "i1", name: "Amoxicillin", quantity: 1 }],
      [inventory("Amoxicillin", 40, { nearestExpiryDate: "2027-06-01" })],
      { today: TODAY }
    );
    expect(later[0].expiresSoon).toBe(false);
  });

  it("treats already-expired batches as needing attention", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Amoxicillin", quantity: 1 }],
      [inventory("Amoxicillin", 40, { nearestExpiryDate: "2026-01-01" })],
      { today: TODAY }
    );
    expect(hints[0].expiresSoon).toBe(true);
  });

  it("honours a custom warning window", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Amoxicillin", quantity: 1 }],
      [inventory("Amoxicillin", 40, { nearestExpiryDate: "2027-01-01" })],
      { today: TODAY, warnDays: 365 }
    );
    expect(hints[0].expiresSoon).toBe(true);
    expect(FEFO_WARN_DAYS).toBe(90);
  });
});

describe("summarizeDispenseWarnings", () => {
  it("says stock is sufficient when nothing is flagged", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Paracetamol", quantity: 2 }],
      [inventory("Paracetamol", 100)],
      { today: TODAY }
    );
    const warnings = summarizeDispenseWarnings(hints);
    expect(warnings.blocked).toBe(false);
    expect(warnings.summary).toContain("Stok cukup");
  });

  it("mentions every warning category in the summary", () => {
    const hints = buildStockHints(
      [
        { itemId: "i1", name: "Amoxicillin", quantity: 30 }, // kurang
        { itemId: "i2", name: "Dexamethasone", quantity: 1 }, // kadaluarsa dekat
        { itemId: "i3", name: "Antasida", quantity: 1 }, // stok rendah
      ],
      [
        inventory("Amoxicillin", 5),
        inventory("Dexamethasone", 50, { nearestExpiryDate: "2026-10-30" }),
        inventory("Antasida", 3),
      ],
      { today: TODAY }
    );
    const warnings = summarizeDispenseWarnings(hints);
    expect(warnings.shortItems).toHaveLength(1);
    expect(warnings.expiringSoon).toHaveLength(1);
    expect(warnings.lowStock).toHaveLength(1);
    expect(warnings.summary).toContain("stoknya tidak cukup");
    expect(warnings.summary).toContain("kadaluarsa");
    expect(warnings.summary).toContain("stok minimum");
  });

  it("does not double-report an item that is both short and low", () => {
    const hints = buildStockHints(
      [{ itemId: "i1", name: "Antasida", quantity: 20 }],
      [inventory("Antasida", 3)],
      { today: TODAY }
    );
    const warnings = summarizeDispenseWarnings(hints);
    expect(warnings.shortItems).toHaveLength(1);
    expect(warnings.lowStock).toHaveLength(0);
    expect(warnings.blocked).toBe(true);
  });
});
