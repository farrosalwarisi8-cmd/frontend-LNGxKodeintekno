import { expect, test, expectAccessDenied } from "./support/fixtures";

/**
 * A3 — Alur review MCU oleh Dokter OH.
 *
 * Data sintetis (mock di dalam browser), selector berbasis role/label, tanpa
 * sleep tetap.
 */

test.describe("A3 — Review MCU (Dokter OH)", () => {
  test("antrean review menampilkan siklus, nilai terhitung, dan penanda perburukan", async ({
    page,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");

    await expect(page.getByRole("heading", { name: "Review MCU — Dokter OH" })).toBeVisible();
    await expect(page.getByTestId("review-queue-item-mcu-cycle-1")).toBeVisible();
    await expect(page.getByText("Budi Santoso").first()).toBeVisible();

    await page.getByTestId("review-queue-item-mcu-cycle-1").click();

    // Nilai terhitung ditampilkan apa adanya dari server.
    await expect(page.getByTestId("calculation-row").first()).toBeVisible();
    await expect(
      page.getByTestId("calculation-row").filter({ hasText: "BMI" }).first()
    ).toContainText("24.5");
    // Penanda perburukan datang dari flag API (ikon + teks).
    await expect(page.getByTestId("worsening-marker").first()).toContainText(
      "Perburukan dibanding tahun lalu"
    );
    // Hasil penunjang terverifikasi (A2) tampil read-only.
    await expect(page.getByTestId("supporting-results")).toContainText("Hemoglobin");
  });

  test("saran sistem yang tidak tersedia ditampilkan jujur", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-1").click();
    await page.getByTestId("open-ftw-decision").click();

    await expect(page.getByTestId("ftw-suggestion-missing")).toBeVisible();
    await expect(page.getByTestId("ftw-suggestion-missing")).toContainText(
      "Saran sistem belum tersedia dari API"
    );
  });

  test("penetapan FTW: konfirmasi -> final -> terkunci", async ({ page, backend, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-1").click();

    await page.getByTestId("open-ftw-decision").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Belum ada request sebelum konfirmasi.
    expect(backend.callsTo("POST", "/mcu/cycles/mcu-cycle-1/ftw-assessment")).toBe(0);

    await page.getByRole("radio", { name: /^Fit Pekerja laik bekerja tanpa/ }).check();
    await page.getByTestId("ftw-review-summary").click();

    // Ringkasan sebelum final.
    await expect(page.getByText("Ringkasan sebelum final")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText("Kategori FTW");

    await page.getByTestId("ftw-confirm").click();

    await expect(page.getByTestId("ftw-locked-notice")).toBeVisible();
    await expect(page.getByTestId("ftw-locked-notice")).toContainText("Fit");
    await expect(page.getByTestId("ftw-locked-notice")).toContainText("addendum");
    expect(backend.callsTo("POST", "/mcu/cycles/mcu-cycle-1/ftw-assessment")).toBe(1);
  });

  test("catatan dokter: draf tersimpan di halaman & penanda belum tersimpan", async ({
    page,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-1").click();

    await expect(page.getByTestId("draft-status")).toContainText("Draf tersimpan di halaman ini");
    await page.getByLabel("Catatan review").fill("Perlu evaluasi ulang");
    await expect(page.getByTestId("draft-status")).toContainText("belum disimpan");
    await page.getByTestId("save-draft").click();
    await expect(page.getByTestId("draft-status")).toContainText("Draf tersimpan di halaman ini");
  });

  test("state error antrean: tombol coba lagi", async ({ page, backend, loginAs }) => {
    backend.fail("GET /mcu/cycles", 500);
    await loginAs("dokter.oh");
    await page.goto("/oh-review");

    await expect(page.getByText("Gagal memuat antrean review")).toBeVisible();
    await page.getByRole("button", { name: "Coba lagi" }).click();
    await expect(page.getByText("Gagal memuat antrean review")).toBeVisible();
  });

  test("HR tidak boleh membuka review MCU", async ({ page, loginAs }) => {
    await loginAs("hr.pic");
    await page.goto("/oh-review");
    await expectAccessDenied(page);
  });

  test("HSE tidak boleh membuka review MCU", async ({ page, loginAs }) => {
    await loginAs("hse.officer");
    await page.goto("/oh-review");
    await expectAccessDenied(page);
  });

  test("admin, lab, dan apoteker tidak boleh membuka review MCU", async ({ page, loginAs }) => {
    for (const username of ["admin.sistem", "lab.analis", "apoteker"]) {
      await loginAs(username);
      await page.goto("/oh-review");
      await expectAccessDenied(page);
    }
  });
});
