/**
 * Suite contract-test browser (tanpa backend) untuk gap F2-C dan F2-D.
 *
 * Semua request jaringan di-mock lewat `page.route` sehingga test ini:
 *  - TIDAK membuat backend baru,
 *  - TIDAK mengklaim business flow sukses (hanya UI mapping),
 *  - diberi label `frontend-contract-test` pada laporan.
 */

function envelope(data, meta) {
  return {
    success: true,
    statusCode: 200,
    message: "Operation completed successfully",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

/** F2-C: keputusan consent publik hanya dikirim saat pengguna menekan tombol. */
export async function runContractConsent(ctx) {
  const { browser, reporter, newPage, bodyText, waitIdle, record } = ctx;
  const scenarios = [
    { id: "ok", status: 200, body: envelope({ status: "SUCCESS", consentStatus: "GRANTED" }), expect: /Persetujuan berhasil dicatat/i, label: "disetujui" },
    { id: "used", status: 400, body: { success: false, statusCode: 400, message: "Consent already used" }, expect: /Tautan sudah digunakan/i, label: "sudah dipakai" },
    { id: "invalid", status: 400, body: { success: false, statusCode: 400, message: "Consent token not found" }, expect: /Tautan tidak valid atau kedaluwarsa/i, label: "invalid" },
    { id: "error", status: 500, body: { success: false, statusCode: 500, message: "Internal server error" }, expect: /Gagal memproses permintaan/i, label: "server error" },
  ];

  for (const scenario of scenarios) {
    const state = { calls: [] };
    const { context, page } = await newPage(browser, [390, 844], `contract-consent-${scenario.id}`);
    try {
      await page.route("**/api/v1/**", async (route) => {
        const req = route.request();
        state.calls.push({ method: req.method(), url: req.url(), body: req.postData() });
        if (req.url().includes("/public/consents/verify")) {
          return route.fulfill({
            status: scenario.status,
            contentType: "application/json",
            body: JSON.stringify(scenario.body),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope([])),
        });
      });

      await page.goto(`${ctx.BASE}/public/consent/token-contract-${scenario.id}`, {
        waitUntil: "domcontentloaded",
      });
      await waitIdle(page);

      if (scenario.id === "ok") {
        record(
          "F2C-01",
          "frontend-contract-test",
          "membuka halaman consent tidak mengirim request apapun (tanpa mutasi token)",
          state.calls.length === 0 ? "PASS" : "FAIL",
          `calls=${state.calls.length}`
        );
      }

      await page.getByRole("button", { name: "Saya setuju" }).click();
      const dialogVisible = await page.getByRole("dialog").isVisible().catch(() => false);
      record(
        `F2C-02-${scenario.id}`,
        "frontend-contract-test",
        "keputusan menunggu konfirmasi pengguna",
        dialogVisible ? "PASS" : "FAIL",
        `dialog=${dialogVisible}`
      );

      await page.getByRole("button", { name: "Setujui" }).click();
      await page.waitForTimeout(600);
      const text = await bodyText(page);

      record(
        `F2C-03-${scenario.id}`,
        "frontend-contract-test",
        `hasil keputusan (${scenario.label}) ditampilkan sesuai respons backend`,
        scenario.expect.test(text) ? "PASS" : "FAIL",
        `snippet="${text.replace(/\s+/g, " ").slice(0, 90)}"`
      );

      const verifyCalls = state.calls.filter(
        (c) => c.method === "POST" && c.url.includes("/public/consents/verify")
      );
      record(
        `F2C-04-${scenario.id}`,
        "frontend-contract-test",
        "tepat satu request keputusan dengan action AGREED (bukan VIEW)",
        verifyCalls.length === 1 && /"action":"AGREED"/.test(verifyCalls[0].body ?? "")
          ? "PASS"
          : "FAIL",
        `calls=${verifyCalls.length} body=${verifyCalls[0]?.body ?? "-"}`
      );

      if (scenario.id === "ok") {
        await reporter.shot(page, "consent-approved-390x844");
      }
      if (scenario.id === "used") {
        record(
          "F2C-05-used",
          "frontend-contract-test",
          "token sudah dipakai tidak pernah ditampilkan sebagai success",
          /Persetujuan berhasil dicatat/i.test(text) ? "FAIL" : "PASS",
          "tidak ada klaim sukses"
        );
        await reporter.shot(page, "consent-used-390x844");
      }
      if (scenario.id === "invalid") {
        await reporter.shot(page, "consent-invalid-390x844");
      }
      if (scenario.id === "error") {
        const retry = await page.getByRole("button", { name: "Coba lagi" }).isVisible().catch(() => false);
        record(
          "F2C-06-error",
          "frontend-contract-test",
          "kegagalan server menawarkan retry dan tidak mengklaim sukses",
          retry && !/Persetujuan berhasil dicatat/i.test(text) ? "PASS" : "FAIL",
          `retryVisible=${retry}`
        );
      }
    } finally {
      await context.close();
    }
  }
}

/** F2-D: daftar pekerja tidak mengirim filter yang tidak didukung & tidak mengarang status. */
export async function runContractPeople(ctx) {
  const { browser, reporter, newPage, bodyText, waitIdle, record } = ctx;
  const state = { calls: [], patientsQueries: [] };

  const { context, page } = await newPage(browser, [1280, 800], "contract-people");
  try {
    await page.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      state.calls.push({ method: req.method(), path: url.pathname, search: url.search });

      if (url.pathname.endsWith("/auth/login")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(
            envelope({
              accessToken: "mock.jwt.token",
              refreshToken: "mock.refresh",
              user: { id: "u-hr", username: "hr.pic", roles: ["HR_ADMIN"] },
            })
          ),
        });
      }
      if (url.pathname.endsWith("/patients")) {
        state.patientsQueries.push(url.search);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(envelope([], { page: 1, limit: 10, total: 0, totalPages: 1 })),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(envelope([])),
      });
    });

    await page.goto(`${ctx.BASE}/login`, { waitUntil: "domcontentloaded" });
    await waitIdle(page);
    await page.getByLabel("Username").fill("hr.pic");
    await page.getByLabel("Password").fill("mock-password-tidak-disimpan");
    await page.getByRole("button", { name: "Masuk" }).first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
    await waitIdle(page);

    await page.goto(`${ctx.BASE}/people`, { waitUntil: "domcontentloaded" });
    await waitIdle(page);
    await page.waitForTimeout(500);

    record(
      "F2D-01",
      "frontend-contract-test",
      "daftar pekerja terbuka untuk HR/PIC",
      /Registrasi & Consent/i.test(await bodyText(page)) ? "PASS" : "FAIL",
      `queries=${state.patientsQueries.length}`
    );

    const unsupported = state.calls.filter((c) =>
      /(siteId|site_id|status=|organizationId|orgUnitId|consentStatus=)/.test(c.search)
    );
    record(
      "F2D-02",
      "frontend-contract-test",
      "tidak ada parameter filter yang tidak didukung API dikirim ke backend",
      unsupported.length === 0 ? "PASS" : "FAIL",
      `unsupported=${unsupported.map((c) => c.search).join(",") || "0"}`
    );

    const allowedOnly = state.patientsQueries.every((q) => {
      const keys = [...new URLSearchParams(q).keys()].sort();
      return keys.every((k) => ["page", "limit", "search"].includes(k));
    });
    record(
      "F2D-03",
      "frontend-contract-test",
      "GET /patients hanya memakai parameter page/limit/search",
      allowedOnly ? "PASS" : "FAIL",
      `queries=${JSON.stringify(state.patientsQueries.slice(0, 3))}`
    );

    const selects = await page.locator("select").count();
    record(
      "F2D-04",
      "frontend-contract-test",
      "tidak ada kontrol filter palsu (select site/unit/status) pada halaman daftar",
      selects === 0 ? "PASS" : "FAIL",
      `selects=${selects}`
    );

    const limitation = await bodyText(page);
    record(
      "F2D-05",
      "frontend-contract-test",
      "keterbatasan filter dijelaskan kepada pengguna (bukan disembunyikan)",
      /belum tersedia.*hanya mendukung\s+pencarian/is.test(limitation) ? "PASS" : "FAIL",
      `snippet="${limitation.replace(/\s+/g, " ").slice(0, 90)}"`
    );

    state.patientsQueries.length = 0;
    await page.getByLabel("Cari pekerja").fill("BUDI");
    await page.waitForTimeout(900);
    record(
      "F2D-06",
      "frontend-contract-test",
      "pencarian diteruskan sebagai parameter search ke backend",
      state.patientsQueries.some((q) => q.includes("search=BUDI")) ? "PASS" : "FAIL",
      `queries=${JSON.stringify(state.patientsQueries)}`
    );

    record(
      "F2D-07",
      "frontend-contract-test",
      "respons kosong menampilkan empty state (bukan data karangan)",
      /Tidak ada pekerja ditemukan/i.test(await bodyText(page)) ? "PASS" : "FAIL",
      "empty state"
    );

    await reporter.shot(page, "people-filter-honesty");
  } finally {
    await context.close();
  }
}
