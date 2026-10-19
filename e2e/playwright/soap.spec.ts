import { expect, test } from "./support/fixtures";

/**
 * Alur 2 — SOAP (rekam medis): draft -> simpan -> finalisasi -> dokumen terkunci.
 *
 * Happy path : SOAP disimpan, lalu difinalisasi sehingga dokumen LOCKED dan
 *              hanya dapat dikoreksi lewat addendum.
 * Error path : backend menolak penyimpanan SOAP (500).
 * Permission : role tanpa `view-clinical-notes` (HR/PIC) -> AccessDenied.
 */

const ENCOUNTER_ID = "enc-1";

async function seedVisit(backend: import("./support/mock-backend").MockBackend) {
  backend.patients.push({
    id: "patient-1",
    mrn: "MRN-E2E-0001",
    fullName: "Budi Santoso",
    employeeNo: "EMP-E2E-001",
    site: "Site A",
    orgUnit: "Unit A",
    sex: "M",
    birthDate: "1990-05-17",
    maskedIdentifier: "****0123",
    employmentStatus: "ACTIVE",
  });
  backend.queue.push({
    id: ENCOUNTER_ID,
    ticket_no: "TKT-0001",
    status: "WAITING",
    created_at: "2026-10-01T08:00:00.000Z",
    appointment: {
      id: "appt-1",
      patient: { id: "patient-1", full_name: "Budi Santoso", medical_record_no: "MRN-E2E-0001" },
    },
  });
  backend.encounters.set(ENCOUNTER_ID, {
    id: ENCOUNTER_ID,
    patient_id: "patient-1",
    status: "IN_SERVICE",
    soap: null,
    addenda: [],
  });
}

test.describe("SOAP rekam medis", () => {
  test("happy path: simpan draft, finalisasi, dokumen terkunci", async ({
    page,
    backend,
    loginAs,
  }) => {
    await seedVisit(backend);
    await loginAs("dokter.oh");
    await page.goto("/medical-records");

    await expect(page.getByRole("heading", { name: "Rekam Medis" })).toBeVisible();
    await page.getByRole("button", { name: "SOAP" }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Isi SOAP.
    await dialog.getByPlaceholder("Keluhan utama...").fill("Sakit kepala sejak 3 hari");
    await dialog.getByPlaceholder("Hasil pemeriksaan fisik...").fill("Tekanan darah 130/85");
    await dialog.getByPlaceholder("Catatan diagnosis...").fill("Diagnosis suspect migraine");
    await dialog.getByPlaceholder("Rencana pengobatan...").fill("Istirahat dan paracetamol");

    // Simpan sebagai draft (belum mengunci).
    await page.getByTestId("soap-save").click();
    await expect(page.getByTestId("soap-save-success")).toContainText("SOAP tersimpan sebagai draft");
    expect(backend.callsTo("PUT", `/clinic/encounters/${ENCOUNTER_ID}/soap`)).toBe(1);

    // Finalisasi memerlukan konfirmasi.
    await page.getByTestId("soap-finalize").click();
    await expect(page.getByText(/Konfirmasi finalisasi kunjungan/)).toBeVisible();
    await page.getByTestId("soap-finalize-confirm").click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(backend.callsTo("POST", `/clinic/encounters/${ENCOUNTER_ID}/finalize`)).toBe(1);

    // Dokumen terkunci: badge Locked dan tombol berubah menjadi Addendum.
    await expect(page.getByText("Locked", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Addendum" }).first()).toBeVisible();

    // Dokumen yang terkunci tidak offers edit SOAP — hanya addendum.
    await page.getByRole("button", { name: "Addendum" }).first().click();
    await expect(page.getByText(/sudah/)).toContainText("LOCKED");
    await expect(page.getByPlaceholder("Alasan perubahan setelah penguncian...")).toBeVisible();
  });

  test("jalur error: backend gagal menyimpan SOAP", async ({ page, backend, loginAs }) => {
    await seedVisit(backend);
    backend.fail(`PUT /clinic/encounters/${ENCOUNTER_ID}/soap`, 500);

    await loginAs("dokter.oh");
    await page.goto("/medical-records");

    await page.getByRole("button", { name: "SOAP" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Keluhan utama...").fill("Keluhan untuk pengujian error");
    await page.getByTestId("soap-save").click();

    await expect(page.getByTestId("soap-save-error")).toContainText(
      "Simulasi kegagalan backend untuk pengujian E2E."
    );
    // Tidak boleh ada finalisasi setelah kegagalan simpan.
    expect(backend.callsTo("POST", `/clinic/encounters/${ENCOUNTER_ID}/finalize`)).toBe(0);
  });

  test("permission ditolak: HR/PIC tidak boleh membuka rekam medis", async ({
    page,
    loginAs,
  }) => {
    await loginAs("hr.pic");
    await page.goto("/medical-records");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rekam Medis" })).toHaveCount(0);
  });
});
