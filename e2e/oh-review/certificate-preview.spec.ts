import { expect, test } from "./support/fixtures";

/**
 * A3 — Resume MCU & pratinjau sertifikat.
 *
 * Pratinjau WAJIB ditandai "belum sah" dan area tanda tangan/QR tetap kosong
 * (diisi pada tahap TTE/A4). Tidak ada tombol unduh dokumen final.
 */

test.describe("A3 — Pratinjau resume & sertifikat", () => {
  test("pratinjau resume ditandai belum sah dan area TTE kosong", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-2").click();

    await page.getByTestId("open-resume-preview").click();

    await expect(page.getByTestId("resume-preview")).toBeVisible();
    await expect(page.getByTestId("preview-notice")).toContainText("PRATINJAU, belum sah");
    await expect(page.getByTestId("signature-placeholder")).toContainText(
      "Area tanda tangan dan QR (diisi pada tahap TTE)"
    );
    await expect(page.getByTestId("qr-placeholder")).toContainText(
      "Area QR verifikasi (diisi pada tahap TTE)"
    );

    // Tidak ada tombol unduh yang menghasilkan dokumen tampak final.
    await expect(page.getByRole("button", { name: /Unduh/i })).toHaveCount(0);
  });

  test("pratinjau sertifikat FTW ditandai belum sah", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-2").click();

    await page.getByTestId("open-certificate-preview").click();

    await expect(page.getByTestId("ftw-certificate-preview")).toBeVisible();
    await expect(page.getByTestId("preview-notice")).toContainText("PRATINJAU, belum sah");
    await expect(page.getByTestId("ftw-certificate-preview")).toContainText(
      "Fit with Restriction"
    );
    await expect(page.getByTestId("ftw-certificate-preview")).toContainText(
      "Dokumen ini belum sah sampai ditandatangani"
    );
  });

  test("pratinjau memuat identitas minimum, hasil, dan keputusan dari API", async ({
    page,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/oh-review");
    await page.getByTestId("review-queue-item-mcu-cycle-2").click();
    await page.getByTestId("open-resume-preview").click();

    const preview = page.getByTestId("resume-preview");
    await expect(preview).toContainText("Siti Aminah");
    await expect(preview).toContainText("MRN-E2E-0002");
    await expect(preview).toContainText("88");
    await expect(preview).toContainText("Fit with Restriction");
  });

  test("role tanpa izin tidak melihat tombol pratinjau", async ({ page, loginAs }) => {
    await loginAs("hr.pic");
    await page.goto("/oh-review");
    await expectAccessDenied(page);
  });
});

async function expectAccessDenied(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
}
