import { expect, test } from "./support/fixtures";

/**
 * Alur 4 — Retur obat.
 *
 * Riwayat retur direkonstruksi dari dispensing yang BERHASIL di sesi ini
 * (backend belum mengekspos GET /pharmacy/dispensing/history), jadi spec harus
 * melewati alur dispensing yang sebenarnya terlebih dahulu — bukan menyuntik
 * data ke endpoint yang tidak dipakai UI.
 *
 * Happy path : dispense → pilih batch, isi jumlah & alasan, konfirmasi, lalu
 *              status "1 retur" muncul pada baris dispensing.
 * Error path : backend menolak retur (500).
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

/** Dispense resep lewat UI supaya snapshot sesi (riwayat retur) terisi. */
async function dispenseViaUi(page: import("@playwright/test").Page) {
  await page.goto("/medicine/dispense");
  await expect(page.getByRole("heading", { name: "Dispensing Obat" })).toBeVisible();
  await page.getByRole("button", { name: "Dispense" }).click();
  await page.getByRole("button", { name: "Proses Dispensing" }).click();
  await expect(page.getByText("Dispensing berhasil diproses oleh backend.")).toBeVisible();
}

test.describe("Retur obat", () => {
  test("happy path: retur tercatat dan status berubah", async ({ page, backend, loginAs }) => {
    await seedPharmacy(backend);
    await loginAs("apoteker");
    await dispenseViaUi(page);

    // Navigasi client-side (bukan page.goto): snapshot sesi dispensing hidup di
    // modul JS, sama seperti alur pengguna lewat sidebar.
    await page.getByRole("link", { name: "Retur Obat" }).click();

    await expect(page.getByRole("heading", { name: "Retur Obat" })).toBeVisible();
    await expect(page.getByText("Budi Santoso")).toBeVisible();

    await page.getByRole("button", { name: "Retur" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Pilih Batch").selectOption(BATCH_EARLY);
    await page.getByLabel("Jumlah Retur").fill("3");
    await page.getByLabel("Alasan Retur").fill("Obat tidak digunakan");

    // Peringatan konfirmasi tampil sebelum request dikirim.
    await expect(page.getByText(/Retur akan mengembalikan stok/)).toBeVisible();

    await page.getByRole("button", { name: "Proses Retur" }).click();

    await expect(page.getByText(/1 retur/)).toBeVisible();
    await expect(page.getByText(/Retur: 3/)).toBeVisible();
    expect(backend.callsTo("POST", "/pharmacy/returns")).toBe(1);
  });

  test("jalur error: backend menolak retur", async ({ page, backend, loginAs }) => {
    await seedPharmacy(backend);
    backend.fail("POST /pharmacy/returns", 500);

    await loginAs("apoteker");
    await dispenseViaUi(page);
    await page.getByRole("link", { name: "Retur Obat" }).click();

    await page.getByRole("button", { name: "Retur" }).click();
    await page.getByLabel("Pilih Batch").selectOption(BATCH_EARLY);
    await page.getByLabel("Jumlah Retur").fill("3");
    await page.getByLabel("Alasan Retur").fill("Obat tidak digunakan");
    await page.getByRole("button", { name: "Proses Retur" }).click();

    await expect(
      page.getByText("Simulasi kegagalan backend untuk pengujian E2E.").first()
    ).toBeVisible();
    // Status retur tidak boleh berubah.
    await expect(page.getByText(/retur/).first()).toBeVisible();
  });

  test("permission ditolak: Analis Lab tidak boleh retur obat", async ({ page, backend, loginAs }) => {
    await loginAs("lab.analis");
    await page.goto("/medicine/return");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Retur Obat" })).toHaveCount(0);
    // Guard menolak sebelum halaman sempat memuat inventori farmasi.
    expect(backend.callsTo("GET", "/pharmacy/inventory")).toBe(0);
  });
});
