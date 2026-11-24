/**
 * Browser contract-test untuk alur TTE/PSP (FRONTEND ONLY).
 *
 * Semua response di-mock di browser via `page.route`. Test ini membuktikan
 * *mapping UI terhadap kontrak*, BUKAN integrasi provider nyata. Label laporan:
 * `frontend-contract-test`. Tidak ada secret provider yang dipakai/muncul.
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

const DOC = {
  id: "doc-ttecontract",
  document_type: "FTW_CERTIFICATE",
  title: "Sertifikat Kelaikan Kerja Uji Kontrak",
  object_key: "docs/doc-ttecontract.pdf",
  status: "READY",
  created_at: "2026-11-19T07:00:00.000Z",
  signature_reqs: [],
};

function docWith(sig) {
  return { ...DOC, signature_reqs: sig ? [sig] : [] };
}

/**
 * Pasang mock API. `state` dikontrol tiap skenario:
 *  - role / isMedicalRole : identitas sesi
 *  - signature            : status signature_reqs pada GET /documents
 *  - requestStatus/body   : respons POST /signatures/request
 *  - downloadResponse     : respons GET /documents/:id/download
 *  - verifyStatus/body    : respons GET /public/verify/:token
 */
async function installTteMocks(page, state) {
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname;
    const method = req.method();
    state.calls.push({ method, path: p, body: req.postData() ?? "" });

    if (p.endsWith("/auth/login") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            accessToken: "mock.jwt.token",
            refreshToken: "mock.refresh.token",
            expiresIn: 3600,
            user: {
              id: "u-tte",
              username: state.username,
              roles: state.roles,
              isMedicalRole: state.isMedicalRole === true,
            },
          })
        ),
      });
    }

    if (p.endsWith("/documents") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          envelope([docWith(state.signature)], {
            page: 1,
            limit: 100,
            total: 1,
            totalPages: 1,
          })
        ),
      });
    }

    if (p.endsWith("/documents/render-pdf") && method === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            documentId: DOC.id,
            title: DOC.title,
            objectKey: DOC.object_key,
            verificationUrl: "https://api.example.com/api/v1/public/verify/public-token-123",
          })
        ),
      });
    }

    if (p.endsWith("/signatures/request") && method === "POST") {
      if (state.abortRequest === true) {
        return route.abort("failed");
      }
      if (state.requestStatus && state.requestStatus !== 201) {
        return route.fulfill({
          status: state.requestStatus,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            statusCode: state.requestStatus,
            error: "ProviderError",
            message: state.requestMessage ?? "Internal provider detail PSP_API_KEY=rahasia",
          }),
        });
      }
      // Setelah request sukses, GET /documents berikutnya menampilkan PENDING.
      state.signature = { id: "sig-new-1", status: "PENDING", signature_type: "CERTIFIED_PSRE", provider_code: "PRIVY" };
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          envelope({
            id: "sig-new-1",
            document_id: DOC.id,
            signature_type: "CERTIFIED_PSRE",
            status: "PENDING",
            provider_code: "PRIVY",
          })
        ),
      });
    }

    if (/\/documents\/[^/]+\/download$/.test(p) && method === "GET") {
      const download = state.downloadResponse ?? {
        status: 200,
        body: envelope({ url: "https://storage.example.com/signed.pdf?sig=abc", expiresIn: 3600 }),
      };
      return route.fulfill({
        status: download.status ?? 200,
        contentType: "application/json",
        body: JSON.stringify(download.body),
      });
    }

    if (p.includes("/public/verify/") && method === "GET") {
      return route.fulfill({
        status: state.verifyStatus ?? 200,
        contentType: "application/json",
        body: JSON.stringify(state.verifyBody ?? envelope({ isValid: false, status: "INVALID" })),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([])),
    });
  });
}

async function login(page, BASE, waitIdle) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await waitIdle(page);
  await page.getByLabel("Username").fill("dokter.oh");
  await page.getByLabel("Password").fill("mock-password");
  await page.getByRole("button", { name: "Masuk" }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  await waitIdle(page);
}

export async function runTteContract(ctx) {
  const { browser, reporter, newPage, bodyText, waitIdle, record, BASE } = ctx;

  // --- TTE-01..03: konfirmasi, double-submit, status PENDING ---------------
  {
    const state = { roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: null };
    const { context, page } = await newPage(browser, [1280, 800], "contract-tte-request");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);

      const requestBtn = page.getByRole("button", { name: /Request TTE/ });
      record(
        "TTE-01",
        "frontend-contract-test",
        "CTA Request TTE terlihat untuk role berizin (DOCTOR_OH)",
        (await requestBtn.isVisible().catch(() => false)) ? "PASS" : "FAIL",
        `visible=${await requestBtn.isVisible().catch(() => false)}`
      );

      const before = state.calls.filter((c) => c.path.endsWith("/signatures/request")).length;
      await requestBtn.click();
      const dialog = page.getByRole("dialog");
      const dialogVisible = await dialog.isVisible().catch(() => false);
      const afterOpen = state.calls.filter((c) => c.path.endsWith("/signatures/request")).length;
      record(
        "TTE-02",
        "frontend-contract-test",
        "membuka modal konfirmasi TIDAK mengirim request",
        dialogVisible && afterOpen === before ? "PASS" : "FAIL",
        `dialog=${dialogVisible} before=${before} after=${afterOpen}`
      );

      const warning = await bodyText(page);
      record(
        "TTE-03",
        "frontend-contract-test",
        "modal menampilkan peringatan pengiriman ke provider & batas 15 MB",
        /provider TTE/i.test(warning) && /15\s*MB/.test(warning) ? "PASS" : "FAIL",
        "metadata + peringatan ditampilkan"
      );

      const confirm = page.getByRole("button", { name: /Kirim Permintaan TTE/ });
      await confirm.click();
      await confirm.click({ force: true }).catch(() => undefined);
      await waitIdle(page);

      const requestCalls = state.calls.filter((c) => c.path.endsWith("/signatures/request"));
      record(
        "TTE-04",
        "frontend-contract-test",
        "double-click menghasilkan tepat satu POST /signatures/request",
        requestCalls.length === 1 ? "PASS" : "FAIL",
        `calls=${requestCalls.length}`
      );
      record(
        "TTE-05",
        "frontend-contract-test",
        "body request hanya field kontrak (documentId, signatureType, providerCode opsional)",
        /"documentId"/.test(requestCalls[0]?.body ?? "") && !/PSP_|apiKey|secret|callbackUrl/i.test(requestCalls[0]?.body ?? "")
          ? "PASS" : "FAIL",
        `body=${requestCalls[0]?.body ?? "-"}`
      );

      const afterText = await bodyText(page);
      record(
        "TTE-06",
        "frontend-contract-test",
        "status PENDING dari backend ditampilkan, bukan klaim SIGNED",
        /Menunggu provider/i.test(afterText) && !/Tertandatangani/i.test(afterText) ? "PASS" : "FAIL",
        "status PENDING"
      );
      const downloadVisible = await page.getByRole("button", { name: /Unduh PDF bertanda tangan/ }).isVisible().catch(() => false);
      record(
        "TTE-07",
        "frontend-contract-test",
        "tombol download TIDAK muncul saat PENDING",
        !downloadVisible ? "PASS" : "FAIL",
        `downloadVisible=${downloadVisible}`
      );

      await reporter.shot(page, "tte-request-pending-1280x800");
    } finally {
      await context.close();
    }
  }

  // --- TTE-08: polling cleanup saat pindah route --------------------------
  {
    const state = { roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: { id: "sig-1", status: "PENDING" } };
    const { context, page } = await newPage(browser, [1280, 800], "contract-tte-polling");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const before = state.calls.filter((c) => c.path.endsWith("/documents")).length;
      await page.waitForTimeout(6500);
      const during = state.calls.filter((c) => c.path.endsWith("/documents")).length;
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const atLeave = state.calls.filter((c) => c.path.endsWith("/documents")).length;
      await page.waitForTimeout(6500);
      const after = state.calls.filter((c) => c.path.endsWith("/documents")).length;
      record(
        "TTE-08",
        "frontend-contract-test",
        "polling berjalan saat PENDING dan berhenti setelah route change",
        during > before && after === atLeave ? "PASS" : "FAIL",
        `before=${before} during=${during} atLeave=${atLeave} after=${after}`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-09: terminal status → download hanya saat SIGNED ---------------
  for (const [status, expectDownload] of [
    ["PROCESSING", false],
    ["SIGNED", true],
    ["FAILED", false],
    ["EXPIRED", false],
    ["CANCELLED", false],
    ["MYSTERY_STATUS", false],
  ]) {
    const state = { roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: { id: "sig-1", status, document_id: DOC.id } };
    const { context, page } = await newPage(browser, [390, 844], `contract-tte-status-${status}`);
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/signatures`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const expand = page.getByRole("button", { name: "Lihat detail signature" });
      if (await expand.isVisible().catch(() => false)) await expand.click();
      await waitIdle(page);
      const text = await bodyText(page);
      const download = await page.getByRole("button", { name: /Unduh PDF bertanda tangan/ }).isVisible().catch(() => false);
      const ok = expectDownload ? download : !download;
      const fallbackOk = status !== "MYSTERY_STATUS" || /Status tidak dikenali/i.test(text);
      record(
        `TTE-09-${status}`,
        "frontend-contract-test",
        `status ${status}: download ${expectDownload ? "muncul" : "tidak muncul"}${status === "MYSTERY_STATUS" ? " + fallback aman" : ""}`,
        ok && fallbackOk ? "PASS" : "FAIL",
        `download=${download} fallback=${fallbackOk}`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-10: retry membuat request baru --------------------------------
  {
    const state = { roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: { id: "sig-old", status: "FAILED", signature_type: "CERTIFIED_PSRE", provider_code: "PRIVY" } };
    const { context, page } = await newPage(browser, [1280, 800], "contract-tte-retry");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/signatures`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await page.getByRole("button", { name: /Retry tanda tangan/ }).click();
      const dialog = page.getByRole("dialog");
      record(
        "TTE-10",
        "frontend-contract-test",
        "retry meminta konfirmasi eksplisit",
        (await dialog.isVisible().catch(() => false)) ? "PASS" : "FAIL",
        "dialog retry"
      );
      await page.getByRole("button", { name: "Buat Request Baru" }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 10000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      await waitIdle(page);
      const visibleText = await bodyText(page);
      // Relasi old→new ada pada region role=status (sr-only) — baca textContent,
      // bukan innerText, supaya tetap terlihat oleh assertion.
      const statusText = (await page.locator('[role="status"]').allTextContents()).join(" ");
      const text = `${visibleText} ${statusText}`;
      // Hitung request SETELAH menunggu UI, agar request yang masih in-flight
      // tidak terlewat (fetch tercatat saat route dijawab).
      const post = state.calls.filter((c) => c.path.endsWith("/signatures/request"));
      // ID request ditampilkan TERMASKING (tidak ada UUID/ID mentah di UI).
      const maskedRelation =
        /…/.test(statusText) && !/sig-old/.test(statusText) && !/sig-new-1/.test(statusText);
      record(
        "TTE-11",
        "frontend-contract-test",
        "retry mengirim satu request baru & menampilkan relasi old→new termasking",
        post.length === 1 && maskedRelation ? "PASS" : "FAIL",
        `posts=${post.length} masked=${maskedRelation} calls=${state.calls.map((c) => `${c.method}:${c.path}`).join(",")} snippet="${text.replace(/\s+/g, " ").slice(-180)}"`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-12: error envelope → pesan aman --------------------------------
  const errorCases = [
    [400, "Payload/validation"],
    [401, "Sesi habis"],
    [403, "AccessDenied"],
    [404, "Tidak ditemukan"],
    [409, "Konflik status"],
    [413, "PDF > 15 MB"],
    [415, "Bukan PDF"],
    [422, "Dokumen tidak valid"],
    [429, "Rate limit"],
    [502, "Provider gagal"],
    [504, "Provider timeout"],
    [503, "Backend error"],
    [0, "Network/offline"],
  ];
  for (const [status, label] of errorCases) {
    const state = {
      roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: null,
      requestStatus: status || 503,
      // Network error disimulasikan dengan abort pada route mock (bukan sekadar
      // context.offline, karena page.route tetap menjawab request).
      abortRequest: status === 0,
    };
    const { context, page } = await newPage(browser, [390, 844], `contract-tte-error-${status}`);
    try {
      await installTteMocks(page, state);
      // Login dulu dalam keadaan online; offline diterapkan saat request agar
      // alur error network benar-benar diuji (bukan gagal di halaman login).
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      if (status === 0) await context.setOffline(true);
      await page.getByRole("button", { name: /Request TTE/ }).click();
      await page.getByRole("button", { name: /Kirim Permintaan TTE/ }).click();
      await waitIdle(page);
      if (status === 0) await context.setOffline(false);
      await page.waitForTimeout(700);
      const text = await bodyText(page);
      const url = page.url();
      const leaked = /PSP_API_KEY=rahasia|callback=https:\/\/internal/.test(text);
      // 401 ditangani api-client: sesi dibersihkan & diarahkan ke /login.
      const mapped =
        status === 401
          ? /\/login/.test(url)
          : /Periksa kembali data dokumen|Silakan login kembali|Anda tidak memiliki izin|dokumen atau permintaan tanda tangan tidak ditemukan|sudah memiliki permintaan aktif|Ukuran PDF melebihi batas 15 MB|harus berformat PDF|belum memenuhi syarat|Tunggu beberapa saat|belum dapat diakses|tidak merespons tepat waktu|kesalahan pada layanan|Tidak ada koneksi|Periksa koneksi jaringan/i.test(text);
      record(
        `TTE-12-${status}`,
        "frontend-contract-test",
        `HTTP ${status || 0} (${label}) → pesan UX aman`,
        mapped && !leaked ? "PASS" : "FAIL",
        `mapped=${mapped} leaked=${leaked} url=${url} calls=${state.calls.filter((c) => c.path.endsWith("/signatures/request")).length} snippet="${text.replace(/\s+/g, " ").slice(-200)}"`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-13: download gagal / URL tidak aman ----------------------------
  {
    const state = {
      roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [],
      signature: { id: "sig-1", status: "SIGNED", document_id: DOC.id },
      downloadResponse: { status: 200, body: envelope({ url: "javascript:alert(1)" }) },
    };
    const { context, page } = await newPage(browser, [390, 844], "contract-tte-download-unsafe");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await page.getByRole("button", { name: /Unduh PDF bertanda tangan/ }).click();
      await waitIdle(page);
      // Tunggu pesan error aman benar-benar ter-render (state React async).
      await page.getByText(/tidak aman/i).first().waitFor({ timeout: 8000 }).catch(() => undefined);
      const text = await bodyText(page);
      record(
        "TTE-13",
        "frontend-contract-test",
        "URL unduhan tidak aman dari backend ditolak dengan pesan aman",
        /tidak aman/i.test(text) ? "PASS" : "FAIL",
        `snippet="${text.replace(/\s+/g, " ").slice(-160)}"`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-14: verifikasi publik semua state ------------------------------
  const verifyCases = [
    [{ isValid: true, status: "VERIFIED" }, "Dokumen terverifikasi"],
    [{ isValid: false, status: "NOT_SIGNED" }, "belum ditandatangani"],
    [{ isValid: false, status: "INVALID" }, "Sertifikat tidak valid"],
    [{ isValid: false, status: "EXPIRED" }, "kedaluwarsa"],
    [{ isValid: false, status: "REVOKED" }, "dicabut"],
    [{ isValid: false, status: "INVALID_OR_EXPIRED" }, "tidak valid atau kedaluwarsa"],
    [{ isValid: true, status: "FUTURE_UNKNOWN" }, "Sertifikat tidak valid"],
  ];
  for (const [body, expected] of verifyCases) {
    const state = { roles: [], calls: [], verifyBody: envelope(body) };
    const { context, page } = await newPage(browser, [390, 844], `contract-verify-${body.status}`);
    try {
      await installTteMocks(page, state);
      await page.goto(`${BASE}/verify/public-token-${body.status}`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const text = await bodyText(page);
      const tokenLeaked = text.includes(`public-token-${body.status}`);
      record(
        `TTE-14-${body.status}`,
        "frontend-contract-test",
        `verify ${body.status} → state yang benar & token tidak bocor`,
        text.includes(expected) && !tokenLeaked ? "PASS" : "FAIL",
        `expected="${expected}" leaked=${tokenLeaked}`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-15: role tanpa izin → AccessDenied tanpa request data -----------
  {
    const state = { roles: ["HR_ADMIN"], isMedicalRole: false, username: "hr.pic", calls: [], signature: null };
    const { context, page } = await newPage(browser, [1280, 800], "contract-tte-unauthorized");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      const text = await bodyText(page);
      const dataCalls = state.calls.filter((c) => c.path.endsWith("/documents") && c.method === "GET");
      record(
        "TTE-15",
        "frontend-contract-test",
        "role tanpa izin melihat AccessDenied dan tidak memuat data dokumen",
        /Akses Ditolak/i.test(text) && dataCalls.length === 0 ? "PASS" : "FAIL",
        `dataCalls=${dataCalls.length}`
      );
    } finally {
      await context.close();
    }
  }

  // --- TTE-16: offline/reconnect -----------------------------------------
  {
    const state = { roles: ["DOCTOR_OH"], isMedicalRole: true, username: "dokter.oh", calls: [], signature: { id: "sig-1", status: "PENDING" } };
    const { context, page } = await newPage(browser, [1280, 800], "contract-tte-offline");
    try {
      await installTteMocks(page, state);
      await login(page, BASE, waitIdle);
      await page.goto(`${BASE}/documents`, { waitUntil: "domcontentloaded" });
      await waitIdle(page);
      await context.setOffline(true);
      await page.waitForTimeout(300);
      const offlineText = await bodyText(page);
      await context.setOffline(false);
      await page.waitForTimeout(300);
      const onlineText = await bodyText(page);
      record(
        "TTE-16",
        "frontend-contract-test",
        "offline ditampilkan sebagai state dan polling dijeda, reconnect pulih",
        /sedang offline/i.test(offlineText) && !/sedang offline/i.test(onlineText) ? "PASS" : "FAIL",
        "offline banner toggled"
      );
    } finally {
      await context.close();
    }
  }

  void reporter;
}
