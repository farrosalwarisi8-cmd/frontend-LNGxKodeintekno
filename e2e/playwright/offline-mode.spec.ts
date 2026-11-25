import { expect, test } from "@playwright/test";

/**
 * Verifikasi PWA/offline (SoW 3.9.5).
 *
 * Berbeda dari spec lain di folder ini, test ini TIDAK mem-mock API: yang diuji
 * adalah lapisan browser (service worker, cache halaman, dan halaman fallback),
 * jadi tidak memerlukan backend.
 */
test.describe("PWA — mode offline", () => {
  test("service worker aktif dan /offline dapat dibuka tanpa jaringan", async ({
    page,
    context,
  }) => {
    await page.goto("/offline");
    await expect(
      page.getByRole("heading", { name: "Anda sedang offline" })
    ).toBeVisible();

    // Registrasi SW berjalan dari PwaProvider di root layout. `clients.claim()`
    // membuat halaman yang sudah terbuka langsung dikontrol SW.
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller !== null,
      undefined,
      { timeout: 30_000 }
    );

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Anda sedang offline" })
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("/sw.js disajikan tanpa cache dan mengecualikan API", async ({ request }) => {
    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-store");
    expect(await sw.text()).toContain('url.pathname.startsWith("/api/")');
  });
});
