/**
 * Fixtures & stub API bersama untuk E2E Fase A2 (Lab & Radiologi).
 *
 * Prinsip (sama dengan contract-suites.mjs):
 *  - Semua request di-mock lewat `page.route` — TANPA backend, TANPA backend
 *    baru. Test diberi label `frontend-contract-test` pada laporan.
 *  - Data sepenuhnya fiktif (id order/tes bukan data pasien nyata).
 *  - State mutable sehingga alur POST→GET (impor, verifikasi, laporan
 *    radiologi) bisa dibuktikan tanpa backend sungguhan.
 */

export function envelope(data, meta) {
  return {
    success: true,
    statusCode: 200,
    message: "Operation completed successfully",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

export function errorEnvelope(status, message) {
  return { success: false, statusCode: status, error: message, message };
}

/** Jenis tes dikonfigurasi "admin" — datang dari API, bukan hardcode UI. */
export const TEST_TYPES = {
  gds: {
    id: "TT-GDS",
    code: "GDS",
    name: "Gula Darah Sewaktu",
    specimen_type: "Serum",
    unit: "mg/dL",
    reference_range: { min: 70, max: 200 },
  },
  chol: {
    id: "TT-CHOL",
    code: "CHOL",
    name: "Kolesterol Total",
    specimen_type: "Serum",
    unit: "mg/dL",
    reference_range: { max: 200 },
  },
  hb: {
    id: "TT-HB",
    code: "HB",
    name: "Hemoglobin",
    specimen_type: "EDTA",
    unit: "g/dL",
    reference_range: { min: 12, max: 17 },
  },
};

/** State mock yang berubah mengikuti aksi pengguna (submit/verify). */
export function makeLabState() {
  return {
    orders: [
      {
        id: "LO-2026-001",
        status: "ORDERED",
        ordered_at: "2026-10-19T08:00:00.000Z",
        ordered_by: "dr-101",
        encounter_id: "ENC-101",
        mcu_cycle_id: "MCU-301",
        order_items: [
          { id: "item-1", lab_test_type_id: "TT-GDS", status: "PENDING", test_type: TEST_TYPES.gds },
          { id: "item-2", lab_test_type_id: "TT-CHOL", status: "PENDING", test_type: TEST_TYPES.chol },
        ],
      },
      {
        id: "LO-2026-002",
        status: "IN_ANALYSIS",
        ordered_at: "2026-10-18T09:15:00.000Z",
        ordered_by: "dr-102",
        encounter_id: "ENC-102",
        mcu_cycle_id: null,
        order_items: [
          { id: "item-3", lab_test_type_id: "TT-HB", status: "IN_ANALYSIS", test_type: TEST_TYPES.hb },
        ],
      },
      {
        id: "LO-2026-003",
        status: "COMPLETED",
        ordered_at: "2026-10-17T07:45:00.000Z",
        ordered_by: "dr-103",
        encounter_id: null,
        mcu_cycle_id: null,
        order_items: [
          { id: "item-4", lab_test_type_id: "TT-GDS", status: "COMPLETED", test_type: TEST_TYPES.gds },
        ],
      },
    ],
    results: [
      {
        id: "LR-1",
        lab_order_item_id: "item-3",
        status: "FINAL",
        verified_by: null,
        verified_at: null,
        values: [
          {
            id: "v-1",
            parameter_name: "Hemoglobin",
            numeric_value: 11,
            unit: "g/dL",
            abnormal_flag: true,
          },
        ],
      },
      {
        id: "LR-2",
        lab_order_item_id: "item-4",
        status: "LOCKED",
        verified_by: "analyst-7",
        verified_at: "2026-10-17T12:00:00.000Z",
        values: [
          {
            id: "v-2",
            parameter_name: "Gula Darah Sewaktu",
            numeric_value: 95,
            unit: "mg/dL",
            abnormal_flag: false,
          },
        ],
      },
    ],
    radiologyOrders: [
      {
        id: "RO-100",
        modality: "CT",
        body_part: "Thorax",
        status: "ORDERED",
        ordered_at: "2026-10-19T09:00:00.000Z",
        ordered_by: "dr-101",
        encounter_id: "ENC-103",
        radiology_result: null,
      },
      {
        id: "RO-101",
        modality: "USG",
        body_part: "Abdomen",
        status: "COMPLETED",
        ordered_at: "2026-10-18T10:30:00.000Z",
        ordered_by: "dr-102",
        encounter_id: "ENC-104",
        radiology_result: {
          id: "RR-1",
          radiology_order_id: "RO-101",
          findings: "Hati berukuran normal, tanpa lesi focal.",
          impression: "Hati dalam batas normal.",
          verified_by: "radiolog-2",
          verified_at: "2026-10-18T15:00:00.000Z",
          files: [],
        },
      },
    ],
    /** Numeric value yang akan digagalkan SATU KALI (uji ulang hanya baris gagal). */
    failPostValuesOnce: new Set(),
    /** Paksa GET daftar order lab gagal (uji state error + coba lagi). */
    failOrdersList: false,
    seq: 100,
  };
}

/**
 * Stub API untuk endpoint diagnostik A2 + fallback envelope kosong untuk
 * endpoint lain (shell tidak butuh data apa pun untuk dirender).
 */
export function makeA2ApiHandler(state, calls) {
  return async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method, path, body });

    const ok = (data, meta) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(envelope(data, meta)) });
    const fail = (status, message) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(errorEnvelope(status, message)) });
    const list = (data) => ok(data, { page: 1, limit: 100, total: data.length, totalPages: 1 });

    const labResultsPath = /\/diagnostic\/lab-results\/([^/]+)\/verify$/.exec(path);
    if (method === "POST" && labResultsPath) {
      const result = state.results.find((r) => r.id === labResultsPath[1]);
      if (!result) return fail(404, "Hasil tidak ditemukan");
      result.verified_at = new Date().toISOString();
      result.verified_by = "analyst-9";
      result.status = "LOCKED";
      return ok(result);
    }

    if (path.endsWith("/diagnostic/lab-results") && method === "POST") {
      const value = body?.values?.[0] ?? {};
      const numeric = value.numericValue;
      if (numeric !== undefined && state.failPostValuesOnce.has(numeric)) {
        state.failPostValuesOnce.delete(numeric);
        return fail(500, "Simulasi kegagalan server untuk baris ini");
      }
      state.seq += 1;
      const created = {
        id: `LR-${state.seq}`,
        lab_order_item_id: body?.labOrderItemId,
        status: "FINAL",
        verified_by: null,
        verified_at: null,
        values: [
          {
            id: `v-${state.seq}`,
            parameter_name: value.parameterName,
            ...(value.numericValue !== undefined
              ? { numeric_value: value.numericValue }
              : { text_value: value.textValue ?? null }),
            unit: value.unit ?? null,
            // abnormal_flag adalah kewenangan server/konfigurasi — mock mengembalikan false
            abnormal_flag: false,
          },
        ],
      };
      state.results.push(created);
      return ok(created);
    }

    if (path.endsWith("/diagnostic/lab-results") && method === "GET") {
      return list(state.results);
    }

    if (/\/diagnostic\/lab-orders\/[^/]+$/.test(path) && method === "GET") {
      const id = decodeURIComponent(path.split("/").pop());
      const order = state.orders.find((o) => o.id === id);
      if (!order) return fail(404, "Order tidak ditemukan");
      return ok(order);
    }

    if (path.endsWith("/diagnostic/lab-orders") && method === "GET") {
      if (state.failOrdersList) return fail(500, "Simulasi kegagalan server");
      return list(state.orders);
    }

    if (path.endsWith("/diagnostic/radiology-results") && method === "POST") {
      state.seq += 1;
      const created = {
        id: `RR-${state.seq}`,
        radiology_order_id: body?.radiologyOrderId,
        findings: body?.findings ?? "",
        impression: body?.impression ?? "",
        verified_by: null,
        verified_at: null,
        files: [],
      };
      const order = state.radiologyOrders.find((o) => o.id === body?.radiologyOrderId);
      if (order) order.radiology_result = created;
      return ok(created);
    }

    if (/\/diagnostic\/radiology-orders\/[^/]+$/.test(path) && method === "GET") {
      const id = decodeURIComponent(path.split("/").pop());
      const order = state.radiologyOrders.find((o) => o.id === id);
      if (!order) return fail(404, "Order tidak ditemukan");
      return ok(order);
    }

    if (path.endsWith("/diagnostic/radiology-orders") && method === "GET") {
      return list(state.radiologyOrders);
    }

    return list([]);
  };
}

/** Seed sesi internal (tanpa login sungguhan) + cookie untuk middleware. */
export async function openA2Session(browser, { base, role, viewport = [1280, 900], label }) {
  const user = {
    id: `u-a2-${role}`,
    username: `demo.${role}`,
    name: `Tester ${role}`,
    password: "",
    role,
    title: role,
    employeeId: "pat-a2",
    mfaEnabled: false,
    preferredLanguage: "id",
  };
  const context = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] } });
  await context.addInitScript(
    ([seeded]) => {
      localStorage.setItem(
        "kodein-klinik-store",
        JSON.stringify({ state: { currentUserId: seeded.id, users: [seeded] }, version: 0 })
      );
      localStorage.setItem(
        "emr-demo-role",
        JSON.stringify({ state: { role: "SYSTEM_ADMIN", enabled: false }, version: 0 })
      );
      localStorage.setItem(
        "kodein_org_scope",
        JSON.stringify({
          organizationId: "org-1",
          orgUnitId: "unit-1",
          siteId: "site-1",
          siteCode: "HQ",
          siteName: "HQ",
          orgName: "Klinik Demo",
        })
      );
    },
    [user]
  );
  await context.addCookies([
    {
      name: "kodein-klinik-store",
      value: encodeURIComponent(JSON.stringify({ state: { currentUserId: user.id } })),
      url: base,
    },
  ]);
  const state = makeLabState();
  const calls = [];
  await context.route("**/api/v1/**", makeA2ApiHandler(state, calls));
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(`${label}: ${e.message}`));
  return { context, page, state, calls, pageErrors };
}
