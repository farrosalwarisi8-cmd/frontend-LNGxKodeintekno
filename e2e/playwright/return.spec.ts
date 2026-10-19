import { expect, test } from "./support/fixtures";

/**
 * Alur 4 — Retur obat.
 *
 * Happy path : pilih batch, isi jumlah & alasan, konfirmasi, lalu status
 *              "Sudah ada retur" muncul pada baris dispensing.
 * Error path : backend menolak retur (500).
 * Permission : role tanpa `dispense-medicine` (Analis Lab) -> AccessDenied.
 */

async function seedDispensing(backend: import("./support/mock-backend").MockBackend) {
  backend.dispensings.push({
    id: "disp-1",
    prescription_id: "rx-1",
    status: "FINAL",
    dispensed_at: "2026-10-02T09:00:00.000Z",
    dispensed_by: "apoteker",
    prescription: {
      id: "rx-1",
      encounter_id: "enc-1",
      encounter: {
        id: "enc-1",
        patient: { id: "patient-1", full_name: "Budi Santoso", medical_record_no: "MRN-E2E-0001" },
      },
      items: [
        {
          id: "rx-item-1",
          medication_id: "med-1",
          quantity: 10,
          medication: { id: "med-1", code: "AMOX-500", generic_name: "Amoxicillin 500 mg" },
        },
      ],
    },
    dispensing_items: [
      {
        id: "disp-item-1",
        stock_batch_id: "batch-early",
        quantity: 10,
        stock_batch: {
          id: "batch-early",
          batch_no: "BN-2026-001",
          expiry_date: "2026-12-01",
          quantity_available: 30,
        },
      },
    ],
    medication_returns: [],
  });
}

test.describe("Retur obat", () => {
  test("happy path: retur tercatat dan status berubah", async ({ page, backend, loginAs }) => {
    await seedDispensing(backend);
    await loginAs("apoteker");
    await page.goto("/medicine/return");

    await expect(page.getByRole("heading", { name: "Retur Obat" })).toBeVisible();
    await expect(page.getByText("Budi Santoso")).toBeVisible();

    await page.getByRole("button", { name: "Retur" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Pilih Batch").selectOption("batch-early");
    await page.getByLabel("Jumlah Retur").fill("3");
    await page.getByLabel("Alasan Retur").fill("Obat tidak digunakan");

    // Langkah pertama hanya menampilkan konfirmasi (belum request).
    await page.getByRole("button", { name: "Proses Retur" }).click();
    await expect(page.getByText(/Konfirmasi retur obat untuk/)).toBeVisible();
    expect(backend.callsTo("POST", "/pharmacy/returns")).toBe(0);

    await page.getByRole("button", { name: "Konfirmasi Retur" }).click();

    await expect(page.getByText("Sudah ada retur")).toBeVisible();
    await expect(page.getByText(/Retur: 3/)).toBeVisible();
    expect(backend.callsTo("POST", "/pharmacy/returns")).toBe(1);
  });

  test("jalur error: backend menolak retur", async ({ page, backend, loginAs }) => {
    await seedDispensing(backend);
    backend.fail("POST /pharmacy/returns", 500);

    await loginAs("apoteker");
    await page.goto("/medicine/return");

    await page.getByRole("button", { name: "Retur" }).click();
    await page.getByLabel("Pilih Batch").selectOption("batch-early");
    await page.getByLabel("Jumlah Retur").fill("3");
    await page.getByLabel("Alasan Retur").fill("Obat tidak digunakan");
    await page.getByRole("button", { name: "Proses Retur" }).click();
    await page.getByRole("button", { name: "Konfirmasi Retur" }).click();

    await expect(
      page.getByText("Simulasi kegagalan backend untuk pengujian E2E.").first()
    ).toBeVisible();
    // Status retur tidak boleh berubah menjadi "Sudah ada retur".
    await expect(page.getByText("Sudah ada retur")).toHaveCount(0);
  });

  test("permission ditolak: Analis Lab tidak boleh retur obat", async ({ page, loginAs }) => {
    await loginAs("lab.analis");
    await page.goto("/medicine/return");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Retur Obat" })).toHaveCount(0);
  });
});
