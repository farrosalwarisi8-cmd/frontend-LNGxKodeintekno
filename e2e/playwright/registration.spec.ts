import { expect, selectOption, test } from "./support/fixtures";

/**
 * Alur 1 — Registrasi pekerja (wizard 5 langkah).
 *
 * Happy path  : wizard sampai selesai, MRN tampil, consent terkirim.
 * Error path  : backend menolak pembuatan pekerja (500) -> pesan error tampil.
 * Duplikat    : identifier yang sudah terdaftar -> blokir sebelum submit.
 * Permission  : role tanpa `manage-employees` (Analis Lab) -> AccessDenied.
 */

const IDENTIFIER = "3201234567890123";

async function fillIdentityStep(page: import("@playwright/test").Page): Promise<void> {
  await page.getByLabel("Nama Lengkap", { exact: true }).fill("Budi Santoso");
  await page.getByLabel("Nomor Identifier", { exact: true }).fill(IDENTIFIER);
  await page.getByLabel("Tanggal Lahir", { exact: true }).fill("1990-05-17");
  await page.getByLabel("Employee ID", { exact: true }).fill("EMP-E2E-001");
}

async function fillPlacementStep(page: import("@playwright/test").Page): Promise<void> {
  await selectOption(page, "Organization", "PT Layar Nusantara Gas");
  await selectOption(page, "Unit Kerja", "HR & GA");
  await selectOption(page, "Site/Office", "Kantor Pusat Jakarta");
}

async function fillContactStep(page: import("@playwright/test").Page): Promise<void> {
  await page.getByLabel("Email Pekerja", { exact: true }).fill("budi.santoso@perusahaan.test");
  await page.getByLabel("Nomor Telepon", { exact: true }).fill("081234567890");
}

test.describe("Registrasi pekerja", () => {
  test("happy path: wizard selesai, MRN tampil, consent terkirim", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("hr.pic");
    await page.goto("/people/new");

    await expect(page.getByRole("heading", { name: "Registrasi Pekerja Baru" })).toBeVisible();

    // Langkah 1 — Identitas
    await fillIdentityStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Langkah 2 — Penempatan
    await expect(page.getByRole("heading", { name: "Penempatan Pekerja" })).toBeVisible();
    await fillPlacementStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Langkah 3 — Kontak
    await expect(page.getByRole("heading", { name: "Kontak Pekerja" })).toBeVisible();
    await fillContactStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Langkah 4 — Dokumen (opsional, boleh dilewati)
    await expect(page.getByRole("heading", { name: "Dokumen Pendukung" })).toBeVisible();
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Langkah 5 — Consent & Review
    await expect(page.getByRole("heading", { name: "Consent & Review" })).toBeVisible();
    await page.getByLabel(/Saya sudah memeriksa data/).check();
    await page.getByRole("button", { name: "Simpan & kirim consent" }).click();

    // Hasil: MRN, Employee ID, dan status consent (dari respons backend).
    await expect(page.getByRole("heading", { name: "Pekerja berhasil didaftarkan" })).toBeVisible();
    await expect(page.getByText("MRN-E2E-0001", { exact: false })).toBeVisible();
    await expect(page.getByText("EMP-E2E-001")).toBeVisible();
    await expect(page.getByText("Menunggu keputusan pekerja")).toBeVisible();
    await expect(page.getByText("Terkirim (simulasi provider)")).toBeVisible();

    // Backend menerima create + consent.
    expect(backend.callsTo("POST", "/patients")).toBe(1);
    expect(backend.callsTo("POST", "/consents/send")).toBe(1);
  });

  test("duplikat identifier diblokir sebelum submit", async ({ page, backend, loginAs }) => {
    backend.patients.push({
      id: "patient-existing",
      mrn: "MRN-EXISTING",
      fullName: "Budi Santoso",
      employeeNo: "EMP-0001",
      site: "Site A",
      orgUnit: "Unit A",
      sex: "M",
      birthDate: "1985-05-15",
      maskedIdentifier: "****0123",
      nationalId: IDENTIFIER,
      employmentStatus: "ACTIVE",
    });

    await loginAs("hr.pic");
    await page.goto("/people/new");

    await page.getByLabel("Nama Lengkap", { exact: true }).fill("Budi Santoso");
    await page.getByLabel("Nomor Identifier", { exact: true }).fill(IDENTIFIER);
    // Blur memicu pemeriksaan duplikat ke backend.
    await page.getByLabel("Tanggal Lahir", { exact: true }).click();

    await expect(
      page.getByText("Identifier ini sudah terdaftar sebagai pekerja aktif.").first()
    ).toBeVisible();

    // Tidak boleh ada request create.
    expect(backend.callsTo("POST", "/patients")).toBe(0);
  });

  test("jalur error: backend gagal menyimpan pekerja", async ({ page, backend, loginAs }) => {
    backend.fail("POST /patients", 500);

    await loginAs("hr.pic");
    await page.goto("/people/new");

    await fillIdentityStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();
    await fillPlacementStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();
    await fillContactStep(page);
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();

    await expect(page.getByRole("heading", { name: "Consent & Review" })).toBeVisible();
    await page.getByLabel(/Saya sudah memeriksa data/).check();
    await page.getByRole("button", { name: "Simpan & kirim consent" }).click();

    // Pesan error backend tampil, dan halaman sukses TIDAK tampil.
    await expect(page.getByText("Simulasi kegagalan backend untuk pengujian E2E.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pekerja berhasil didaftarkan" })
    ).toHaveCount(0);
  });

  test("permission ditolak: Analis Lab tidak boleh membuka wizard registrasi", async ({
    page,
    loginAs,
  }) => {
    await loginAs("lab.analis");
    await page.goto("/people/new");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Registrasi Pekerja Baru" })).toHaveCount(0);
  });
});
