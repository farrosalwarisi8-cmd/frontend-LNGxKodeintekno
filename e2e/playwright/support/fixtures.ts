import { expect, test as base, type Page } from "@playwright/test";
import {
  createMockBackend,
  installMockBackend,
  type MockBackend,
} from "./mock-backend";

/**
 * Fixture E2E alur mutasi.
 *
 * - `backend` : state mock milik test ini saja (isolasi data antar test).
 * - `loginAs` : login dengan role backend tertentu lalu assertion sudah di
 *               halaman shell (bukan dashboard, supaya tidak bergantung pada
 *               halaman yang tidak diuji).
 */
export interface E2EFixtures {
  backend: MockBackend;
  loginAs: (username: string) => Promise<void>;
}

export const test = base.extend<E2EFixtures>({
  backend: async ({ page }, use) => {
    const backend = createMockBackend();
    await installMockBackend(page, backend);
    await use(backend);
  },

  loginAs: async ({ page }, use) => {
    await use(async (username: string) => {
      await login(page, username);
    });
  },
});

export { expect };

/** Login melalui form login memakai kredensial E2E (tanpa data nyata). */
export async function login(page: Page, username: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("e2e-password-lokal");
  await page.getByRole("button", { name: "Masuk" }).click();
  // Tunggu sampai shell internal ter-render (menu sidebar muncul).
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
}

/** Pastikan halaman ditolak oleh route guard (AccessDenied). */
export async function expectAccessDenied(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
  await expect(page.getByText("Anda tidak punya izin untuk membuka halaman ini.")).toBeVisible();
}

/** Pilih opsi pada komponen Select (Base UI combobox). */
export async function selectOption(page: Page, label: string, optionLabel: string): Promise<void> {
  const control = page.getByLabel(label, { exact: true }).first();
  const tag = await control.evaluate((el) => el.tagName.toLowerCase());

  // Formulir native: pilih langsung lewat <select>.
  if (tag === "select" && (await control.isVisible())) {
    await control.selectOption({ label: optionLabel });
    return;
  }

  // Base UI: trigger button + popup listbox. <select> tersembunyi (untuk
  // submit form) ikut punya role combobox, jadi hanya yang terlihat diklik.
  await page.getByRole("combobox", { name: label }).filter({ visible: true }).click();
  await page
    .getByRole("option", { name: optionLabel, exact: true })
    .filter({ visible: true })
    .click();
}
