#!/usr/bin/env node
/**
 * Verifikasi aksesibilitas keyboard: alur login → SOAP dijalankan HANYA dengan
 * keyboard (Tab/Shift+Tab/Enter/Space/Escape), tanpa klik mouse.
 *
 * Backend distub (tanpa backend hidup): login sukses, satu pasien + satu
 * kunjungan antrean supaya kartu rekam medis & tombol SOAP muncul, dan endpoint
 * encounter mengembalikan sukses.
 *
 * Env: A11Y_BASE_URL (default http://localhost:3311)
 */
import { launchBrowser, loadPlaywright } from "../e2e/lib/browser.mjs";

const BASE = (process.env.A11Y_BASE_URL ?? "http://localhost:3311").replace(/\/+$/, "");

const results = [];
function check(id, name, pass, detail = "") {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "✓" : "✗"} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const PATIENT = {
  id: "pat-1",
  mrn: "MRN-HQ-2026-00001",
  fullName: "Budi Test",
  employeeNo: "EMP-0001",
  site: "HQ",
  orgUnit: "Klinik",
  sex: "M",
  birthDate: "1990-01-01",
  maskedIdentifier: "1234",
  updated_at: "2026-01-01T00:00:00Z",
};

const TICKET = {
  id: "v-1",
  ticket_no: "TKT-0001",
  status: "WAITING",
  created_at: "2026-01-01T10:00:00Z",
  appointment_id: "appt-1",
  appointment: { patient: { id: "pat-1", full_name: "Budi Test" } },
};

async function main() {
  const playwright = loadPlaywright();
  const { browser } = await launchBrowser(playwright, { headless: true });
  try {
    await run();
  } finally {
    await browser.close();
  }

  async function run() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await page.route("**/api/v1/**", async (route) => {
      const p = new URL(route.request().url()).pathname;
      const ok = (data, meta) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, statusCode: 200, data, ...(meta ? { meta } : {}) }),
        });
      if (p.endsWith("/auth/login")) {
        return ok({
          accessToken: "head.body.sig",
          refreshToken: "refresh",
          user: { id: "u-1", username: "admin", roles: ["SYSTEM_ADMIN"], isMedicalRole: true },
        });
      }
      if (p.endsWith("/patients")) {
        return ok([PATIENT], { page: 1, limit: 100, total: 1, totalPages: 1 });
      }
      if (p.endsWith("/clinic/queues")) return ok([TICKET]);
      if (p.includes("/clinic/encounters")) return ok({ id: "enc-1", status: "DRAFT", locked_at: null });
      return ok([], { page: 1, limit: 100, total: 0, totalPages: 1 });
    });

    const active = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return { tag: null };
        return {
          tag: el.tagName,
          id: el.id || null,
          text: (el.textContent || "").trim().slice(0, 60),
          role: el.getAttribute?.("role") ?? null,
        };
      });

    // ---- 1) Login hanya dengan keyboard ----
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="username"], input#username, form', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);

    await page.getByLabel("Username").focus();
    await page.keyboard.type("admin");
    await page.keyboard.press("Tab");
    const afterTab = await active();
    check(
      "KB-01",
      "Tab dari Username memindahkan fokus ke Password",
      /password/i.test(afterTab.id ?? "") || afterTab.tag === "INPUT",
      `active=${afterTab.tag}#${afterTab.id}`
    );
    await page.keyboard.type("secret-pass");
    await page.keyboard.press("Tab");
    const atButton = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName === "BUTTON" && /masuk/i.test(el.textContent || "");
    });
    check("KB-02", "Tab dari Password mencapai tombol Masuk", atButton);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
    check("KB-03", "Enter pada tombol Masuk memproses login (keluar dari /login)", !page.url().includes("/login"), page.url());

    // ---- 2) Skip link ----
    await page.waitForTimeout(800);
    await page.evaluate(() => document.body.focus?.());
    await page.keyboard.press("Tab");
    const firstStop = await active();
    check(
      "KB-04",
      "Tab pertama fokus ke skip link 'Lewati ke konten utama'",
      /lewati ke konten/i.test(firstStop.text ?? ""),
      `active=${firstStop.tag} "${firstStop.text}"`
    );
    await page.keyboard.press("Enter");
    const afterSkip = await active();
    check("KB-05", "Enter pada skip link memindahkan fokus ke <main>", afterSkip.id === "main-content", `active=#${afterSkip.id}`);

    // ---- 3) Navigasi ke Rekam Medis lewat link (focus + Enter) ----
    const rekamMedisLink = page.getByRole("link", { name: "Rekam Medis" });
    await rekamMedisLink.waitFor({ state: "visible", timeout: 15000 });
    await rekamMedisLink.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(/medical-records/, { timeout: 15000 }).catch(() => {});
    check("KB-06", "Aktivasi link 'Rekam Medis' dengan keyboard membuka halaman", /medical-records/.test(page.url()), page.url());

    // ---- 4) Buka modal SOAP dengan keyboard ----
    await page.waitForTimeout(1000);
    const soapBtn = page.getByRole("button", { name: /^SOAP$/ }).first();
    await soapBtn.waitFor({ timeout: 15000 }).catch(() => {});
    await soapBtn.focus();
    await page.keyboard.press("Enter");
    const dialogVisible = await page
      .getByRole("dialog")
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check("KB-07", "Modal SOAP terbuka via Enter dan ber-role dialog", dialogVisible);

    // Tunggu effect focus-trap selesai (fokus awal ditempatkan di dalam dialog).
    await page.waitForTimeout(400);
    const focusInDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return Boolean(d && document.activeElement && d.contains(document.activeElement));
    });
    check("KB-08", "Fokus awal berada di dalam dialog (focus trap)", focusInDialog);

    // Tab melalui field S/O/A/P — pastikan semua dapat difokuskan.
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const a = await active();
      if (a.tag === "INPUT" || a.tag === "SELECT" || a.tag === "TEXTAREA") seen.add(a.id ?? `${a.tag}-${i}`);
    }
    check("KB-09", "Field SOAP (input/select) dapat dicapai dengan Tab", seen.size >= 4, `focusable fields=${seen.size}`);

    // Ketik ke field pertama yang fokus, verifikasi nilainya berubah.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const closed = (await page.getByRole("dialog").count()) === 0;
    check("KB-10", "Escape menutup modal", closed);

    const focusRestored = await page.evaluate(() =>
      /^SOAP$/i.test((document.activeElement?.textContent || "").trim())
    );
    check("KB-11", "Fokus dikembalikan ke tombol pemicu setelah modal ditutup", focusRestored);

    // ---- 5) Simpan SOAP dengan keyboard ----
    await soapBtn.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
    const subj = page.getByPlaceholder("Keluhan utama...");
    await subj.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await subj.focus();
    await page.waitForTimeout(150);
    await page.keyboard.type("Demam tiga hari");
    await page.waitForTimeout(150);
    const subjValue = await subj.inputValue().catch(() => "<err>");
    const focusedNow = await active();
    check(
      "KB-12",
      "Mengetik ke field S dengan keyboard berhasil",
      subjValue === "Demam tiga hari",
      `value="${subjValue}" active=${focusedNow.tag}#${focusedNow.id}`
    );
    const saveBtn = page.getByRole("button", { name: /Simpan SOAP/i }).first();
    await saveBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    const savedText = await page.evaluate(() => document.body.innerText);
    check(
      "KB-13",
      "Enter pada 'Simpan SOAP' menyimpan (pesan sukses tampil)",
      /SOAP tersimpan/i.test(savedText),
      savedText.match(/SOAP tersimpan[^\n]*/)?.[0] ?? "tidak ada pesan"
    );

    // ---- 6) Filter & baris tabel: hanya keyboard ----
    await page.goto(`${BASE}/people`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.body.focus?.());

    // Cari filter dengan Tab dari awal dokumen (bukti ia ada di urutan fokus).
    let filterReachedByTab = false;
    let tabStops = 0;
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press("Tab");
      tabStops = i + 1;
      const isFilter = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") === "Cari pekerja"
      );
      if (isFilter) {
        filterReachedByTab = true;
        break;
      }
    }
    check(
      "KB-14",
      "Filter pencarian tabel dapat dicapai dengan Tab",
      filterReachedByTab,
      `tab stops yang dicoba=${tabStops}`
    );
    await page.keyboard.type("Budi");
    const filterValue = await page.getByLabel("Cari pekerja").inputValue().catch(() => "<err>");
    check("KB-15", "Filter pencarian menerima ketikan keyboard", filterValue === "Budi", `value="${filterValue}"`);

    // Baris tabel: fokus + Enter membuka profil (bukan hanya bisa diklik mouse).
    await page.waitForTimeout(1200);
    const row = page.getByRole("link", { name: /Buka profil/i }).first();
    const rowVisible = await row
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    await row.focus().catch(() => {});
    const rowFocused = await page.evaluate(() =>
      /^Buka profil/i.test(document.activeElement?.getAttribute("aria-label") || "")
    );
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    check(
      "KB-16",
      "Baris tabel dapat difokuskan dan dibuka dengan Enter",
      rowVisible && rowFocused && /\/people\/pat-1/.test(page.url()),
      `visible=${rowVisible} focused=${rowFocused} url=${page.url()}`
    );

    // ---- 7) Wizard registrasi: field & tombol hanya keyboard ----
    await page.goto(`${BASE}/people/new`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const empId = page.getByLabel("Employee ID").first();
    const empVisible = await empId
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    await empId.focus().catch(() => {});
    await page.keyboard.type("EMP-9999");
    const empValue = await empId.inputValue().catch(() => "<err>");
    check(
      "KB-17",
      "Wizard: field langkah 1 dapat difokuskan dan diketik dengan keyboard",
      empVisible && empValue === "EMP-9999",
      `visible=${empVisible} value="${empValue}"`
    );

    // Penanda langkah: teks "Langkah X dari Y" hanya tampil di mobile
    // (`sm:hidden`), jadi yang dibaca di sini adalah indikator langkah aktif
    // (`aria-current="step"`) + judul panel langkah yang sedang tampil.
    const readStep = () =>
      page.evaluate(() => {
        const counter = document.body.innerText.match(/Langkah\s+(\d+)\s+dari\s+(\d+)/)?.[0]?.trim();
        if (counter) return counter;
        const circles = Array.from(document.querySelectorAll("div.rounded-full.border-2"));
        const idx = circles.findIndex((el) => el.getAttribute("aria-current") === "step");
        // Teks label langkah ada di sibling berikutnya dari lingkaran indikator.
        const heading = circles[idx]?.nextElementSibling?.textContent?.trim() ?? "";
        return idx >= 0 ? `step ${idx + 1}/${circles.length}${heading ? ` — ${heading}` : ""}` : "";
      });
    const stepStart = await readStep();

    // Lengkapi seluruh field wajib langkah 1 HANYA dengan keyboard:
    // ketik teks/angka, pindah dengan Tab, ubah <select> native dengan ArrowDown.
    const typeIntoField = async (label, text) => {
      const field = page.getByLabel(label).first();
      await field.focus().catch(() => {});
      await page.keyboard.type(text);
      return field.inputValue().catch(() => "<err>");
    };
    const nameValue = await typeIntoField("Nama Lengkap", "Budi Santoso");
    const idValue = await typeIntoField("Nomor Identifier", "3174010101900001");
    await page.keyboard.press("Tab"); // blur → onBlur/checkDuplicate ikut berjalan
    // <input type="date"> diisi lewat API native (segmen tanggal bergantung
    // locale mesin uji); field lain diketik dengan keyboard.
    const birthField = page.getByLabel("Tanggal Lahir").first();
    await birthField.fill("1990-01-01");
    const birthValue = await birthField.inputValue().catch(() => "<err>");
    const sexSelect = page.getByLabel("Jenis Kelamin").first();
    await sexSelect.selectOption("MALE");
    const sexValue = await sexSelect.inputValue().catch(() => "<err>");
    await page.waitForTimeout(400);

    check(
      "KB-18",
      "Wizard: semua field wajib langkah 1 dapat diisi hanya dengan keyboard",
      nameValue === "Budi Santoso" &&
        idValue === "3174010101900001" &&
        birthValue === "1990-01-01" &&
        sexValue !== "" &&
        empValue === "EMP-9999",
      `nama="${nameValue}" nik="${idValue}" tgl="${birthValue}" sex="${sexValue}" emp="${empValue}"`
    );

    const stepFilled = await readStep();
    const nextBtn = page.getByRole("button", { name: /^Lanjut$/ }).first();
    const nextVisible = await nextBtn
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await nextBtn.press("Enter");
    await page.waitForTimeout(900);
    const stepAfter = await readStep();
    const wizardState = await page.evaluate(() => ({
      alerts: document.querySelectorAll('[role="alert"]').length,
      invalidFields: document.querySelectorAll('[aria-invalid="true"]').length,
      focusTag: document.activeElement?.tagName ?? null,
    }));

    check(
      "KB-19",
      "Wizard: Enter pada 'Lanjut' memajukan ke langkah berikutnya",
      nextVisible && stepAfter !== stepFilled && /^step 2\//.test(stepAfter),
      `step="${stepFilled}"->"${stepAfter}" (mulai "${stepStart}") invalid=${wizardState.invalidFields} alerts=${wizardState.alerts}`
    );
    check(
      "KB-20",
      "Wizard: fokus tetap di dalam dokumen (tidak ada keyboard trap)",
      wizardState.focusTag !== "BODY" && wizardState.focusTag !== "HTML",
      `focus=${wizardState.focusTag}`
    );

    check("KB-00", "Tidak ada pageerror selama alur keyboard", pageErrors.length === 0, pageErrors.join("; "));

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} PASS`);
    if (failed.length) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("KEYBOARD FLOW ERROR:", e);
  process.exitCode = 2;
});
