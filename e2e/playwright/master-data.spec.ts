import { expect, test } from "./support/fixtures";

/**
 * Alur 6 — Master data organisasi: tambah, ubah, nonaktifkan.
 *
 * Happy path : organisasi baru dibuat, nama diperbarui, lalu status diubah
 *              menjadi INACTIVE (dengan konfirmasi).
 * Error path : kode ganda ditolak backend (409).
 * Permission : role tanpa `manage-master-data` (HR/PIC) -> AccessDenied.
 */

async function seedOrganizations(backend: import("./support/mock-backend").MockBackend) {
  backend.organizations.push({
    id: "org-1",
    code: "ORG-LNG",
    name: "PT Layar Nusantara Gas",
    status: "ACTIVE",
  });
}

test.describe("Master data", () => {
  test("happy path: tambah, ubah, dan nonaktifkan perusahaan", async ({
    page,
    backend,
    loginAs,
  }) => {
    await seedOrganizations(backend);
    await loginAs("admin.sistem");
    await page.goto("/master-data");

    await expect(page.getByRole("heading", { name: "Master Data" })).toBeVisible();
    await page.getByRole("button", { name: /^Perusahaan/ }).click();
    await expect(page.getByText("PT Layar Nusantara Gas")).toBeVisible();

    // --- Tambah ---
    await page.getByRole("button", { name: "Tambah" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Kode", { exact: true }).fill("ORG-E2E");
    await page.getByLabel("Nama", { exact: true }).fill("PT E2E Nusantara");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("PT E2E Nusantara")).toBeVisible();
    expect(backend.callsTo("POST", "/master-data/organizations")).toBe(1);

    // --- Ubah ---
    const newRow = page.getByTestId("master-data-row").filter({ hasText: "PT E2E Nusantara" });
    await newRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Nama", { exact: true }).fill("PT E2E Nusantara (Diperbarui)");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(page.getByText("PT E2E Nusantara (Diperbarui)")).toBeVisible();

    // --- Nonaktifkan (dengan konfirmasi) ---
    const updatedRow = page
      .getByTestId("master-data-row")
      .filter({ hasText: "PT E2E Nusantara (Diperbarui)" });
    await updatedRow.getByRole("button", { name: "Nonaktifkan" }).click();
    await expect(page.getByRole("heading", { name: "Konfirmasi Nonaktifkan Data" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Nonaktifkan" }).click();

    await expect(updatedRow.getByText("INACTIVE")).toBeVisible();
  });

  test("jalur error: kode perusahaan sudah dipakai (409)", async ({ page, backend, loginAs }) => {
    await seedOrganizations(backend);
    await loginAs("admin.sistem");
    await page.goto("/master-data");

    await page.getByRole("button", { name: /^Perusahaan/ }).click();
    await page.getByRole("button", { name: "Tambah" }).click();
    await page.getByLabel("Kode", { exact: true }).fill("ORG-LNG");
    await page.getByLabel("Nama", { exact: true }).fill("PT Duplikat");
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect(
      page.getByText("Kode sudah dipakai (409 Conflict). Gunakan kode lain.").first()
    ).toBeVisible();
    expect(backend.organizations.filter((o) => o.code === "ORG-LNG")).toHaveLength(1);
  });

  test("permission ditolak: HR/PIC tidak boleh mengelola master data", async ({
    page,
    loginAs,
  }) => {
    await loginAs("hr.pic");
    await page.goto("/master-data");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Master Data" })).toHaveCount(0);
  });
});
