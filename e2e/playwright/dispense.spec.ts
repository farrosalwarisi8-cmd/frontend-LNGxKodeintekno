import { expect, test } from "./support/fixtures";

/**
 * Alur 3 — Dispense obat (FEFO) + pengurangan stok di UI.
 *
 * Happy path : engine FEFO memilih batch dengan kadaluarsa terdekat, alokasi
 *              dikirim ke backend, dan stok pada UI (/medicine) berkurang.
 * Error path : backend menolak dispensing (500).
 * Permission : role tanpa `dispense-medicine` (Analis Lab) -> AccessDenied.
 */

const MEDICATION_ID = "med-1";
const BATCH_EARLY = "batch-early";
const BATCH_LATE = "batch-late";

async function seedPharmacy(backend: import("./support/mock-backend").MockBackend) {
  backend.inventory.push({
    id: MEDICATION_ID,
    medicationCode: "AMOX-500",
    genericName: "Amoxicillin",
    strength: "500 mg",
    dosageForm: "Kapsul",
    siteName: "Site A",
    currentStock: 100,
    minimumStock: 10,
    isLowStock: false,
    activeBatchesCount: 2,
    nearestExpiryDate: "2026-12-01",
  });
  // Batch paling awal kedaluwarsa HARUS dipakai lebih dulu (FEFO).
  backend.batches.push(
    {
      batchId: BATCH_EARLY,
      batchNo: "BN-2026-001",
      expiryDate: "2026-12-01",
      available: 40,
      medicationId: MEDICATION_ID,
    },
    {
      batchId: BATCH_LATE,
      batchNo: "BN-2027-002",
      expiryDate: "2027-06-01",
      available: 60,
      medicationId: MEDICATION_ID,
    }
  );
  backend.prescriptions.push({
    id: "rx-1",
    encounter_id: "enc-1",
    status: "ACTIVE",
    prescribed_at: "2026-10-01T08:00:00.000Z",
    encounter: {
      id: "enc-1",
      patient: { id: "patient-1", full_name: "Budi Santoso", medical_record_no: "MRN-E2E-0001" },
    },
    items: [
      {
        id: "rx-item-1",
        medication_id: MEDICATION_ID,
        quantity: 10,
        dosage: "3x1 sehari",
        medication: {
          id: MEDICATION_ID,
          code: "AMOX-500",
          generic_name: "Amoxicillin 500 mg",
          strength: "500 mg",
        },
      },
    ],
  });
}

test.describe("Dispense obat (FEFO)", () => {
  test("happy path: FEFO, dispense berhasil, stok berkurang di UI", async ({
    page,
    backend,
    loginAs,
  }) => {
    await seedPharmacy(backend);
    await loginAs("apoteker");
    await page.goto("/medicine/dispense");

    await expect(page.getByRole("heading", { name: "Dispensing Obat" })).toBeVisible();
    await expect(page.getByText("Budi Santoso")).toBeVisible();
    await expect(page.getByText("1 item obat")).toBeVisible();

    await page.getByRole("button", { name: "Dispense" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Item obat pada prescription (nama obat dari backend).
    await expect(page.getByText("Amoxicillin 500 mg")).toBeVisible();
    await page.getByRole("button", { name: "Proses Dispensing" }).click();

    await expect(page.getByText("Dispensing berhasil diproses oleh backend.")).toBeVisible();
    expect(backend.callsTo("POST", "/pharmacy/dispensing")).toBe(1);

    // FEFO: batch dengan kadaluarsa terdekat yang dipilih lebih dulu.
    const allocation = backend.calls.find((c) => c.path === "/pharmacy/dispensing");
    expect(allocation).toBeDefined();

    // Stok berkurang di UI: navigasi ke halaman farmasi dan periksa total stok.
    await page.goto("/medicine");
    await expect(page.getByRole("heading", { name: "Farmasi" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Amoxicillin 500 mg" });
    await expect(row.getByTestId("medicine-stock")).toHaveText("90");
  });

  test("FEFO: alokasi memakai batch dengan kedaluwarsa terdekat", async ({
    page,
    backend,
    loginAs,
  }) => {
    await seedPharmacy(backend);
    await loginAs("apoteker");
    await page.goto("/medicine/dispense");

    await page.getByRole("button", { name: "Dispense" }).click();
    await page.getByRole("button", { name: "Proses Dispensing" }).click();
    await expect(page.getByText("Dispensing berhasil diproses oleh backend.")).toBeVisible();

    // Batch awal (BN-2026-001) masih punya 40, jadi 10 unit dialokasikan ke sana.
    const early = backend.batches.find((b) => b.batchId === BATCH_EARLY);
    const late = backend.batches.find((b) => b.batchId === BATCH_LATE);
    expect(early?.available).toBe(30);
    expect(late?.available).toBe(60);
  });

  test("jalur error: backend menolak dispensing", async ({ page, backend, loginAs }) => {
    await seedPharmacy(backend);
    backend.fail("POST /pharmacy/dispensing", 500);

    await loginAs("apoteker");
    await page.goto("/medicine/dispense");

    await page.getByRole("button", { name: "Dispense" }).click();
    await page.getByRole("button", { name: "Proses Dispensing" }).click();

    await expect(page.getByText("Simulasi kegagalan backend untuk pengujian E2E.")).toBeVisible();
    // Tidak boleh ada alokasi stok yang terpakai.
    const early = backend.batches.find((b) => b.batchId === BATCH_EARLY);
    expect(early?.available).toBe(40);
  });

  test("permission ditolak: Analis Lab tidak boleh dispensing", async ({ page, loginAs }) => {
    await loginAs("lab.analis");
    await page.goto("/medicine/dispense");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dispensing Obat" })).toHaveCount(0);
  });
});
