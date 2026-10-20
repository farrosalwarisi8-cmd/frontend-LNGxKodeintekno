import { expect, test, expectAccessDenied } from "../oh-review/support/fixtures";

/**
 * A3 — Modul D&A (akses terbatas).
 *
 * - Hasil tersembunyi secara default (harus dibuka secara sadar).
 * - Chain of custody hanya-tambah.
 * - Confirmation test hanya tampil bila data API menandainya perlu.
 * - Data D&A tidak boleh masuk URL.
 */

test.describe("A3 — Modul D&A", () => {
  test("hasil screening tersembunyi secara default", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/dna");

    await expect(page.getByRole("heading", { name: "D&A Forensik — Dokter OH" })).toBeVisible();
    await page.getByTestId("dna-test-da-test-1").click();

    await expect(page.getByTestId("dna-results-hidden")).toBeVisible();
    await expect(page.getByTestId("dna-results-visible")).toHaveCount(0);
    await expect(page.getByTestId("dna-screening-result")).toHaveCount(0);
  });

  test("hasil hanya tampil setelah tindakan sadar 'Tampilkan hasil'", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/dna");
    await page.getByTestId("dna-test-da-test-1").click();

    await page.getByTestId("reveal-dna-results").click();

    await expect(page.getByTestId("dna-results-visible")).toBeVisible();
    await expect(page.getByTestId("dna-screening-result")).toContainText("NON_NEGATIVE");
    await expect(page.getByTestId("dna-results-hidden")).toHaveCount(0);
  });

  test("chain of custody: lini waktu read-only & menambah kejadian", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/dna");
    await page.getByTestId("dna-test-da-test-1").click();

    const timeline = page.getByTestId("custody-timeline");
    await expect(timeline).toBeVisible();
    await expect(timeline).toContainText("Sampel dikumpulkan & disegel");
    await expect(timeline).toContainText("Officer E2E (Collector)");

    await page.getByLabel("Dari (pelaku pengirim)").fill("Officer E2E");
    await page.getByLabel("Ke (pelaku penerima)").fill("Laboratorium E2E");
    await page.getByLabel("Aksi").fill("HANDED_TO_COURIER");
    await page.getByTestId("add-custody-event").click();

    await expect(timeline).toContainText("Diserahkan ke kurir");
    expect(backend.callsTo("POST", "/da/samples/sample-1/chain-of-custody")).toBe(1);
  });

  test("confirmation test tampil bila data API menandainya perlu", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("dokter.oh");
    await page.goto("/dna");
    await page.getByTestId("dna-test-da-test-1").click();
    await page.getByTestId("reveal-dna-results").click();

    await expect(page.getByText("Confirmation test diperlukan")).toBeVisible();
    await page.getByLabel("Hasil konfirmasi").selectOption("NEGATIVE");
    await page.getByTestId("submit-confirmation").click();

    expect(backend.callsTo("POST", "/da/tests/da-test-1/results")).toBe(1);
  });

  test("data D&A tidak masuk URL", async ({ page, loginAs }) => {
    await loginAs("dokter.oh");
    await page.goto("/dna");
    await page.getByTestId("dna-test-da-test-1").click();
    await page.getByTestId("reveal-dna-results").click();

    const url = page.url();
    expect(url).not.toContain("da-test-1");
    expect(url).not.toContain("Budi");
    expect(url).not.toContain("MRN");
  });

  test("HR, lab, admin, dan HSE tidak boleh membuka modul D&A", async ({ page, loginAs }) => {
    for (const username of ["hr.pic", "lab.analis", "admin.sistem", "hse.officer"]) {
      await loginAs(username);
      await page.goto("/dna");
      await expectAccessDenied(page);
    }
  });
});
