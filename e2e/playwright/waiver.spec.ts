import { expect, test } from "./support/fixtures";

/**
 * Alur 5 — Waiver visitor: keputusan setuju dan tolak.
 *
 * Happy path : keputusan wajib lewat dialog konfirmasi, lalu status waiver
 *              berubah menjadi APPROVED / REJECTED.
 * Error path : backend menolak keputusan (500).
 * Permission : role tanpa `manage-hse` (HR/PIC) -> AccessDenied.
 */

async function seedWaiver(backend: import("./support/mock-backend").MockBackend, id: string) {
  backend.waivers.push({
    id,
    visitor_name: "Tamu Eksternal",
    company: "PT Vendor Kijang",
    purpose: "Kunjungan/aplikasi apa",
    valid_until: "2026-12-31",
    status: "PENDING",
    lifecycle: "PENDING",
    site: { id: "site-1", code: "SITE-A", name: "Site A" },
    waiver_consent: null,
  });
}

test.describe("Waiver visitor", () => {
  test("happy path: keputusan SETUJU", async ({ page, backend, loginAs }) => {
    await seedWaiver(backend, "waiver-1");
    await loginAs("hse.officer");
    await page.goto("/waiver");

    await expect(page.getByRole("heading", { name: "Waiver Visitor" })).toBeVisible();
    await expect(page.getByText("Tamu Eksternal")).toBeVisible();

    // Keputusan WAJIB dikonfirmasi dulu — belum ada request sebelum konfirmasi.
    await page.getByTestId("waiver-approve-waiver-1").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Konfirmasi Setuju" })).toBeVisible();
    expect(backend.callsTo("POST", "/waivers/waiver-1/decision")).toBe(0);

    await page.getByTestId("waiver-decision-confirm").click();

    await expect(page.getByText("APPROVED", { exact: true })).toBeVisible();
    await expect(page.getByTestId("waiver-row-result")).toContainText("Waiver disetujui.");
    expect(backend.callsTo("POST", "/waivers/waiver-1/decision")).toBe(1);
  });

  test("happy path: keputusan TOLAK", async ({ page, backend, loginAs }) => {
    await seedWaiver(backend, "waiver-2");
    await loginAs("hse.officer");
    await page.goto("/waiver");

    await page.getByTestId("waiver-reject-waiver-2").click();
    await expect(page.getByRole("heading", { name: "Konfirmasi Tolak" })).toBeVisible();
    await page.getByTestId("waiver-decision-confirm").click();

    await expect(page.getByText("REJECTED", { exact: true })).toBeVisible();
    await expect(page.getByTestId("waiver-row-result")).toContainText("Waiver ditolak.");
    expect(backend.callsTo("POST", "/waivers/waiver-2/decision")).toBe(1);
  });

  test("jalur error: backend menolak keputusan waiver", async ({ page, backend, loginAs }) => {
    await seedWaiver(backend, "waiver-3");
    backend.fail("POST /waivers/waiver-3/decision", 500);

    await loginAs("hse.officer");
    await page.goto("/waiver");

    await page.getByTestId("waiver-approve-waiver-3").click();
    await page.getByTestId("waiver-decision-confirm").click();

    await expect(
      page.getByText("Simulasi kegagalan backend untuk pengujian E2E.").first()
    ).toBeVisible();
    await expect(page.getByTestId("waiver-row-result")).toContainText(
      "Simulasi kegagalan backend untuk pengujian E2E."
    );
    // Status badge waiver tetap PENDING (keputusan gagal disimpan).
    await expect(page.getByText("PENDING", { exact: true })).toBeVisible();
    await expect(page.getByText("APPROVED", { exact: true })).toHaveCount(0);
  });

  test("permission ditolak: HR/PIC tidak boleh memutuskan waiver", async ({ page, loginAs }) => {
    await loginAs("hr.pic");
    await page.goto("/waiver");

    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Waiver Visitor" })).toHaveCount(0);
  });
});
