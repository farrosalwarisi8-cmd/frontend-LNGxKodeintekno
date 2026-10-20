import { expect, test, expectAccessDenied } from "./support/fixtures";

/**
 * A3 — Management restriksi kerja.
 *
 * Hanya Dokter OH yang boleh mengakhiri restriksi. Role lain (HR, HSE,
 * manajemen) tidak punya route, tidak punya tombol aksi, dan ditolak saat
 * mengakses langsung.
 */

test.describe("A3 — Restriksi kerja", () => {
  test("Dokter OH melihat restriksi aktif beserta jenis, tanggal, dan penetap", async ({
    page,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review/restrictions");

    await expect(
      page.getByRole("heading", { name: "Restriksi Kerja", exact: true })
    ).toBeVisible();
    const row = page.getByTestId("restriction-row-restriction-1");
    await expect(row).toBeVisible();
    await expect(row).toContainText("Dilarang bekerja di ketinggian lebih dari 2 meter");
    await expect(row).toContainText("Supervisor Lapangan HSE");
    // Status restriksi ditampilkan apa adanya dari API.
    await expect(row).toContainText("ACTIVE");
  });

  test("mengakhiri restriksi wajib memakai alasan dan konfirmasi", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review/restrictions");

    await page.getByTestId("close-restriction-restriction-1").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Alasan wajib: tanpa alasan, permintaan tidak dikirim.
    await page.getByTestId("confirm-close-restriction").click();
    await expect(page.getByText("Alasan pengakhiran restriksi wajib diisi.")).toBeVisible();
    expect(backend.callsTo("POST", "/mcu/restrictions/restriction-1/close")).toBe(0);

    await page.getByLabel("Alasan pengakhiran (wajib)").fill("Pekerja sudah selesai masa adaptasi");
    await page.getByTestId("confirm-close-restriction").click();

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(backend.callsTo("POST", "/mcu/restrictions/restriction-1/close")).toBe(1);
  });

  test("aksi ubah & hapus nonaktif dengan alasan (endpoint belum tersedia)", async ({
    page,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review/restrictions");

    await expect(page.getByTestId("edit-restriction-restriction-1")).toBeDisabled();
    await expect(page.getByTestId("delete-restriction-restriction-1")).toBeDisabled();
  });

  test("HR tidak boleh membuka management restriksi", async ({ page, loginAs }) => {
    await loginAs("hr.pic");
    await page.goto("/oh-review/restrictions");
    await expectAccessDenied(page);
  });

  test("HSE tidak boleh membuka management restriksi", async ({ page, loginAs }) => {
    await loginAs("hse.officer");
    await page.goto("/oh-review/restrictions");
    await expectAccessDenied(page);
  });

  test("manajemen & admin tidak boleh membuka management restriksi", async ({
    page,
    loginAs,
  }) => {
    for (const username of ["manajemen", "admin.sistem"]) {
      await loginAs(username);
      await page.goto("/oh-review/restrictions");
      await expectAccessDenied(page);
    }
  });
});
