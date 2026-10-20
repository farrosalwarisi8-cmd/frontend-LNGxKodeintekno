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
  // Frontend membuka encounter dulu (POST /clinic/encounters) sebelum menyimpan
  // SOAP, jadi mock harus memberi encounter yang dipakai untuk SOAP/finalize.
  backend.encounterIdForVisit = ENCOUNTER_ID;
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
    await page.getByRole("button", { name: "Simpan SOAP" }).click();
    await expect(page.getByText(/SOAP tersimpan di backend/)).toBeVisible();
    expect(backend.callsTo("PUT", `/clinic/encounters/${ENCOUNTER_ID}/soap`)).toBe(1);

    // Setelah SOAP tersimpan, form ditutup. Buka lagi untuk finalisasi.
    await page.getByRole("button", { name: "SOAP" }).first().click();
    await page.getByRole("button", { name: /Finalize/ }).click();
    await expect(page.getByText(/dikunci permanen|dikunci/)).toBeVisible();
    expect(backend.callsTo("POST", `/clinic/encounters/${ENCOUNTER_ID}/finalize`)).toBe(1);

    // Dokumen terkunci: badge "Terkunci" + tombol "Lihat" (read-only).
    await expect(page.getByText("Terkunci", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Lihat" }).first().click();
    await expect(page.getByText(/Rekam medis terkunci/)).toBeVisible();
    // Field SOAP non-editable saat record terkunci.
    await expect(page.getByText(/Koreksi hanya melalui Addendum/)).toBeVisible();
  });

  test("jalur error: backend gagal menyimpan SOAP", async ({ page, backend, loginAs }) => {
    await seedVisit(backend);
    backend.fail(`PUT /clinic/encounters/${ENCOUNTER_ID}/soap`, 500);

    await loginAs("dokter.oh");
    await page.goto("/medical-records");

    await page.getByRole("button", { name: "SOAP" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Keluhan utama...").fill("Keluhan untuk pengujian error");
    await page.getByRole("button", { name: "Simpan SOAP" }).click();

    await expect(page.getByText(/Simulasi kegagalan backend untuk pengujian E2E/)).toBeVisible();
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
