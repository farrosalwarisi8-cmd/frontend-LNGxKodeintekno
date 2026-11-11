import { expect, test } from "./support/fixtures";

/**
 * E2E proteksi permission (Fase A1 — matriks admin, Admin Klinik, HR).
 *
 * Tiga lapis diuji di sini:
 *  1. menu/navigasi  — item yang tidak berizin tidak dirender,
 *  2. route guard    — tautan langsung tetap AccessDenied,
 *  3. data           — dashboard role tidak memanggil endpoint klinis.
 *
 * Catatan Admin Klinik: backend tidak punya kode role padanannya (lihat
 * ROLE_MAPPING.md), sehingga sesi Admin Klinik dibangun lewat demo mode di
 * /demo. Itu tetap menguji lapis proteksi UI yang diubah pada Fase A1 —
 * otorisasi server tetap tanggung jawab backend (lihat catatan BLOCKER
 * BACKEND di tes berikut).
 */

/** Navigasi sidebar (aside + nav sama-sama berlabel "Navigasi utama"). */
function sidebar(page: import("@playwright/test").Page) {
  return page.locator("aside").getByRole("navigation", { name: "Navigasi utama" });
}

test.describe("Permission matrix", () => {
  test("admin: menu klinis hilang, halaman klinis ditolak, dashboard tidak memuat data klinis", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("admin.sistem");

    // Lapis 3 (data): dashboard System Administrator tidak memuat direktori
    // pasien, antrean klinik, maupun inventori farmasi.
    //
    // Catatan: `GET /mcu/cycles` tetap dipanggil karena satu-satunya sumber
    // data `view-health-status` (yang dipertahankan untuk admin) adalah endpoint
    // itu. Endpoint tersebut mengembalikan data MCU klinis penuh → tercatat sebagai
    // BLOCKER BACKEND: dibutuhkan endpoint status-saja.
    expect(backend.callsTo("GET", "/patients")).toBe(0);
    expect(backend.callsTo("GET", "/clinic/queues")).toBe(0);
    expect(backend.callsTo("GET", "/pharmacy/inventory")).toBe(0);

    // Lapis 1 (menu): klinis/farmasi/pekerja tidak ada; domain admin ada.
    for (const label of [
      "MCU & FTW",
      "Rekam Medis",
      "Dispensing",
      "Retur Obat",
      "Registrasi & Consent",
      "Direktori Pekerja",
    ]) {
      await expect(sidebar(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
    for (const label of ["User", "Master Data", "Audit Log", "Laporan"]) {
      await expect(sidebar(page).getByRole("link", { name: label, exact: true })).toHaveCount(1);
    }

    // Lapis 2 (route): tautan langsung tetap AccessDenied.
    for (const route of ["/medical-records", "/mcu", "/people/new", "/medicine/dispense"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    }
  });

  test("admin: menu halaman kontrol sistem tetap tersedia", async ({ page, loginAs }) => {
    await loginAs("admin.sistem");

    for (const label of ["Sistem", "API Key", "TTE Monitoring", "Emergency Mode"]) {
      await expect(sidebar(page).getByRole("link", { name: label, exact: true })).toHaveCount(1);
    }
  });

  test("HR/PIC: menu user & master data hilang dan kedua halaman ditolak", async ({
    page,
    backend,
    loginAs,
  }) => {
    await loginAs("hr.pic");

    await expect(sidebar(page).getByRole("link", { name: "User", exact: true })).toHaveCount(0);
    await expect(sidebar(page).getByRole("link", { name: "Master Data", exact: true })).toHaveCount(0);
    // Domain HR tetap ada.
    await expect(sidebar(page).getByRole("link", { name: "Direktori Pekerja", exact: true })).toHaveCount(1);

    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    // Guard menolak sebelum halaman sempat memuat daftar akun.
    expect(backend.callsTo("GET", "/iam/users")).toBe(0);

    await page.goto("/master-data");
    await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    expect(backend.callsTo("GET", "/master-data/organizations")).toBe(0);
  });

  test("Admin Klinik: field klinis tidak dirender di daftar kunjungan", async ({
    page,
    backend,
    loginAs,
  }) => {
    // Data sintetis untuk memastikan tabel benar-benar terisi (bukan vacuous).
    backend.queue.push({
      id: "q-a1-clinic",
      ticket_no: "TKT-A1-001",
      status: "WAITING",
      created_at: "2026-10-27T08:00:00.000Z",
      appointment: {
        id: "appt-a1",
        patient: {
          id: "patient-a1",
          full_name: "Pekerja Uji A1",
          medical_record_no: "MRN-A1-0001",
        },
      },
    });

    // Kontrol positif: role klinis melihat kolom klinis.
    await loginAs("dokter.oh");
    await page.goto("/visits");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Keluhan" })).toHaveCount(1);
    await expect(
      page.getByText("Field klinis dibatasi untuk role Admin Klinik.")
    ).toHaveCount(0);

    // Admin Klinik lewat demo mode (tanpa padanan kode role backend).
    await page.goto("/demo");
    await page.getByRole("button", { name: "Admin Klinik" }).click();
    await page.goto("/visits");

    // Penanda bahwa field klinis dibatasi untuk role ini.
    await expect(page.getByText("Field klinis dibatasi untuk role Admin Klinik.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Keluhan" })).toHaveCount(0);
    // Baris kunjungan tetap tampil (data administratif).
    await expect(page.getByRole("cell", { name: /TKT-A1-001/ })).toBeVisible();

    // Lapis 1: menu Admin Klinik tanpa modul klinis/farmasi/administrasi sistem.
    for (const label of [
      "Rekam Medis",
      "MCU & FTW",
      "Dispensing",
      "Farmasi",
      "User",
      "Master Data",
    ]) {
      await expect(sidebar(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
    for (const label of ["Kunjungan", "Antrean", "Registrasi & Consent"]) {
      await expect(sidebar(page).getByRole("link", { name: label, exact: true })).toHaveCount(1);
    }

    // Lapis 2: halaman klinis tetap AccessDenied untuk Admin Klinik.
    for (const route of ["/medical-records", "/mcu"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Akses Ditolak" })).toBeVisible();
    }
  });
});
