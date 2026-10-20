/**
 * Mock backend E2E Fase A3 (Playwright).
 *
 * Backend MOCK dijalankan di dalam browser (Playwright `page.route`) — bukan
 * backend baru dan bukan server sungguhan. Tujuannya membuktikan perilaku
 * frontend A3 (antrean review, penetapan FTW, restriksi, pratinjau sertifikat,
 * dan modul D&A) tanpa bergantung pada backend yang belum siap.
 *
 * Aturan:
 *  - Setiap test membuat state-nya sendiri (factory di bawah) sehingga tidak
 *    bergantung pada urutan test.
 *  - Data sepenuhnya sintetis (nama, MRN, NIP fiktif). Tidak ada data pasien
 *    nyata.
 *  - `backend.fail("GET /mcu/cycles", 500)` untuk menguji jalur error.
 */
import type { Page, Request, Route } from "@playwright/test";

export interface MockCall {
  method: string;
  path: string;
}

export interface MockBackend {
  calls: MockCall[];
  failures: Map<string, number>;
  cycles: MockMcuCycle[];
  documents: MockDocument[];
  daTests: MockDaTest[];
  fail: (key: string, status?: number) => void;
  callsTo: (method: string, path: string) => number;
}

export interface MockMcuCycle {
  id: string;
  patient_id: string;
  mcu_type: string;
  examination_date: string;
  valid_from?: string;
  valid_until?: string;
  status?: string;
  patient?: {
    id?: string;
    medical_record_no?: string;
    full_name?: string;
    employee?: {
      employee_no?: string;
      full_name?: string;
      site?: { id?: string; code?: string; name?: string };
    };
  };
  calculations?: Array<Record<string, unknown>>;
  ftw_assessment?: MockFtwAssessment | null;
}

export interface MockFtwAssessment {
  id: string;
  ftw_status: string;
  summary?: string | null;
  assessed_by?: string | null;
  assessed_at?: string;
  valid_until?: string;
  restrictions?: MockRestriction[];
}

export interface MockRestriction {
  id: string;
  description?: string;
  effective_date?: string;
  review_date?: string;
  supervisor?: string | null;
  controls?: string | null;
  status?: string;
}

export interface MockDocument {
  id: string;
  document_type?: string;
  title?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  sha256_hash?: string | null;
  signature_reqs?: Array<{ id?: string; status?: string; signature_type?: string }>;
}

export interface MockDaTest {
  id: string;
  patient_id?: string;
  test_type?: string;
  status?: string;
  created_at?: string;
  collected_at?: string | null;
  patient?: {
    id?: string;
    medical_record_no?: string;
    full_name?: string;
  };
  samples?: MockDaSample[];
  results?: MockDaResult[];
  certificate?: { id: string } | null;
}

export interface MockDaSample {
  id: string;
  da_test_id?: string;
  sample_no?: string;
  specimen_type?: string;
  status?: string;
  sealed_at?: string | null;
  custody_chain?: MockCustodyEntry[];
}

export interface MockCustodyEntry {
  id: string;
  sample_id?: string;
  from_party: string;
  to_party: string;
  action: string;
  signature_hash: string;
  event_at: string;
}

export interface MockDaResult {
  id: string;
  da_test_id?: string;
  screening_result?: string;
  confirmation_result?: string | null;
  confirmed?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
}

function envelope(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    statusCode: 200,
    message: "Operation completed successfully",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

function errorEnvelope(status: number, message: string) {
  return {
    success: false,
    statusCode: status,
    error: "Error",
    message,
    timestamp: new Date().toISOString(),
  };
}

/** JWT palsu (payload base64) — tidak pernah dipakai untuk otorisasi. */
export function fakeJwt(organizationId = "org-1", username = "e2e"): string {
  const payload = Buffer.from(
    JSON.stringify({ organizationId, sub: "e2e", username })
  ).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.e2e-signature`;
}

/** Data sintetis default (satu siklus tanpa keputusan + satu siklus berdecided). */
export function createMockBackend(): MockBackend {
  return {
    calls: [],
    failures: new Map(),
    cycles: [
      {
        id: "mcu-cycle-1",
        patient_id: "patient-1",
        mcu_type: "ANNUAL_PERIODIC",
        examination_date: "2026-10-01",
        status: "COMPLETED",
        patient: {
          id: "patient-1",
          medical_record_no: "MRN-E2E-0001",
          full_name: "Budi Santoso",
          employee: {
            employee_no: "EMP-E2E-001",
            full_name: "Budi Santoso",
            site: { id: "site-1", code: "SITE-A", name: "Site A" },
          },
        },
        calculations: [
          { name: "bmi", value: 24.5, unit: "kg/m2" },
          { name: "systolic_bp", value: 132, unit: "mmHg" },
          { name: "audiometry", value: 30, unit: "dB", worsening: true },
        ],
        ftw_assessment: null,
      },
      {
        id: "mcu-cycle-2",
        patient_id: "patient-2",
        mcu_type: "SPECIAL_HAZARD",
        examination_date: "2026-09-20",
        valid_until: "2027-09-20",
        status: "COMPLETED",
        patient: {
          id: "patient-2",
          medical_record_no: "MRN-E2E-0002",
          full_name: "Siti Aminah",
          employee: {
            employee_no: "EMP-E2E-002",
            full_name: "Siti Aminah",
            site: { id: "site-2", code: "SITE-B", name: "Site B" },
          },
        },
        calculations: [{ name: "spirometry", value: 88, unit: "%" }],
        ftw_assessment: {
          id: "assessment-2",
          ftw_status: "FIT_WITH_RESTRICTION",
          summary: "Laik bekerja dengan pembatasan.",
          assessed_by: "user-dokter-oh",
          assessed_at: "2026-09-21T08:00:00.000Z",
          valid_until: "2027-09-20",
          restrictions: [
            {
              id: "restriction-1",
              description: "Dilarang bekerja di ketinggian lebih dari 2 meter",
              effective_date: "2026-09-21",
              review_date: "2027-01-04",
              supervisor: "Supervisor Lapangan HSE",
              controls: "Wajib penempatan tugas lantai dasar",
              status: "ACTIVE",
            },
          ],
        },
      },
    ],
    documents: [
      {
        id: "doc-1",
        document_type: "FTW_CERTIFICATE",
        title: "Sertifikat Kelaikan Kerja MCU-MCU-CY",
        status: "DRAFT",
        created_at: "2026-09-21T09:00:00.000Z",
        updated_at: "2026-09-21T09:00:00.000Z",
        sha256_hash: "e2ehash0000000000000000000000",
        signature_reqs: [],
      },
    ],
    daTests: [
      {
        id: "da-test-1",
        patient_id: "patient-1",
        test_type: "RANDOM_INSPECTION",
        status: "CONFIRMATION_PENDING",
        created_at: "2026-10-01T07:00:00.000Z",
        collected_at: "2026-10-01T07:05:00.000Z",
        patient: {
          id: "patient-1",
          medical_record_no: "MRN-E2E-0001",
          full_name: "Budi Santoso",
        },
        samples: [
          {
            id: "sample-1",
            da_test_id: "da-test-1",
            sample_no: "SMP-E2E-0001",
            specimen_type: "URINE",
            status: "SEALED",
            sealed_at: "2026-10-01T07:10:00.000Z",
            custody_chain: [
              {
                id: "custody-1",
                sample_id: "sample-1",
                from_party: "Officer E2E (Collector)",
                to_party: "Laboratorium E2E",
                action: "SAMPLE_COLLECTED_AND_SEALED",
                signature_hash: "e2esignature0000000000000001",
                event_at: "2026-10-01T07:10:00.000Z",
              },
            ],
          },
        ],
        results: [
          {
            id: "da-result-1",
            da_test_id: "da-test-1",
            screening_result: "NON_NEGATIVE",
            confirmation_result: null,
            confirmed: false,
          },
        ],
        certificate: null,
      },
    ],
    fail(key: string, status = 500) {
      this.failures.set(key, status);
    },
    callsTo(method: string, path: string) {
      return this.calls.filter((c) => c.method === method && c.path === path).length;
    },
  };
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** Pasang interceptor untuk seluruh `/api/v1/**`. */
export async function installMockBackend(page: Page, backend: MockBackend): Promise<void> {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "") || "/";
    const method = request.method();
    backend.calls.push({ method, path });

    const failureKey = `${method} ${path}`;
    const failureStatus = backend.failures.get(failureKey);
    if (failureStatus) {
      return json(
        route,
        failureStatus,
        errorEnvelope(failureStatus, "Simulasi kegagalan backend untuk pengujian E2E.")
      );
    }

    const body = await readJsonBody(request);

    // ---- Auth ------------------------------------------------------------
    if (method === "POST" && path === "/auth/login") {
      const username = (body as { username?: string })?.username ?? "unknown";
      const roles = rolesForUsername(username);
      return json(
        route,
        200,
        envelope({
          accessToken: fakeJwt("org-1", username),
          refreshToken: "e2e-refresh-token",
          expiresIn: 3600,
          user: { id: `user-${username}`, username, roles, isMedicalRole: roles[0] !== "HR_ADMIN" },
        })
      );
    }

    // ---- MCU -------------------------------------------------------------
    if (method === "GET" && path === "/mcu/cycles") {
      const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const rows = search
        ? backend.cycles.filter((cycle) =>
            [
              cycle.patient?.full_name,
              cycle.patient?.medical_record_no,
              cycle.patient?.employee?.employee_no,
              `MCU-${cycle.id.slice(0, 8).toUpperCase()}`,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(search)
          )
        : backend.cycles;
      return json(
        route,
        200,
        envelope(rows, { page: 1, limit: 100, total: rows.length, totalPages: 1 })
      );
    }

    if (method === "POST" && /^\/mcu\/cycles\/[^/]+\/ftw-assessment$/.test(path)) {
      const id = path.split("/")[3];
      const cycle = backend.cycles.find((c) => c.id === id);
      const payload = (body ?? {}) as {
        ftwStatus?: string;
        summary?: string;
        restriction?: { description?: string; reviewDate?: string };
      };
      if (cycle) {
        cycle.ftw_assessment = {
          id: `assessment-${id}`,
          ftw_status: payload.ftwStatus ?? "FIT",
          summary: payload.summary ?? null,
          assessed_by: "user-dokter-oh",
          assessed_at: new Date().toISOString(),
          restrictions:
            payload.restriction?.description
              ? [
                  {
                    id: `restriction-${id}`,
                    description: payload.restriction.description,
                    effective_date: new Date().toISOString().slice(0, 10),
                    review_date: payload.restriction.reviewDate,
                    status: "ACTIVE",
                  },
                ]
              : [],
        };
      }
      return json(route, 201, envelope(cycle?.ftw_assessment ?? {}));
    }

    if (method === "POST" && /^\/mcu\/restrictions\/[^/]+\/close$/.test(path)) {
      const id = path.split("/")[3];
      for (const cycle of backend.cycles) {
        const restriction = cycle.ftw_assessment?.restrictions?.find((r) => r.id === id);
        if (restriction) restriction.status = "CLOSED";
      }
      return json(route, 200, envelope({ id, status: "CLOSED" }));
    }

    // ---- Dokumen ---------------------------------------------------------
    if (method === "GET" && path === "/documents") {
      return json(
        route,
        200,
        envelope(backend.documents, {
          page: 1,
          limit: 100,
          total: backend.documents.length,
          totalPages: 1,
        })
      );
    }

    // ---- Penunjang (A2, read-only) --------------------------------------
    if (method === "GET" && path === "/diagnostic/lab-orders") {
      return json(
        route,
        200,
        envelope(
          [
            {
              id: "lab-order-1",
              mcu_cycle_id: "mcu-cycle-1",
              status: "COMPLETED",
              ordered_at: "2026-10-01T08:00:00.000Z",
              order_items: [{ id: "lab-order-item-1", status: "COMPLETED" }],
            },
          ],
          { page: 1, limit: 100, total: 1, totalPages: 1 }
        )
      );
    }

    if (method === "GET" && path === "/diagnostic/lab-results") {
      return json(
        route,
        200,
        envelope(
          [
            {
              id: "lab-result-1",
              lab_order_item_id: "lab-order-item-1",
              status: "VERIFIED",
              verified_by: "user-lab",
              verified_at: "2026-10-01T12:00:00.000Z",
              values: [
                {
                  id: "lab-value-1",
                  parameter_name: "Hemoglobin",
                  numeric_value: 14.2,
                  unit: "g/dL",
                  abnormal_flag: false,
                },
              ],
            },
          ],
          { page: 1, limit: 100, total: 1, totalPages: 1 }
        )
      );
    }

    // ---- D&A -------------------------------------------------------------
    if (method === "GET" && path === "/da/tests") {
      const status = url.searchParams.get("status");
      const rows = status
        ? backend.daTests.filter((test) => test.status === status)
        : backend.daTests;
      // Bentuk backend: objek paginasi berada DI DALAM envelope `data`
      // (lihat `daService.getTests` yang membaca `res.data`).
      return json(
        route,
        200,
        envelope(
          { data: rows, meta: { page: 1, limit: 100, total: rows.length, totalPages: 1 } },
          { page: 1, limit: 100, total: rows.length, totalPages: 1 }
        )
      );
    }

    if (method === "POST" && /^\/da\/samples\/[^/]+\/chain-of-custody$/.test(path)) {
      const id = path.split("/")[3];
      const payload = (body ?? {}) as {
        fromParty?: string;
        toParty?: string;
        action?: string;
      };
      for (const test of backend.daTests) {
        const sample = test.samples?.find((s) => s.id === id);
        if (sample) {
          sample.custody_chain = [
            ...(sample.custody_chain ?? []),
            {
              id: `custody-${(sample.custody_chain?.length ?? 0) + 1}`,
              sample_id: id,
              from_party: payload.fromParty ?? "",
              to_party: payload.toParty ?? "",
              action: payload.action ?? "",
              signature_hash: `e2esignature${Date.now()}`,
              event_at: new Date().toISOString(),
            },
          ];
        }
      }
      return json(route, 201, envelope({ ok: true }));
    }

    if (method === "POST" && /^\/da\/tests\/[^/]+\/results$/.test(path)) {
      const id = path.split("/")[3];
      const payload = (body ?? {}) as {
        screeningResult?: string;
        confirmationResult?: string;
        confirmed?: boolean;
      };
      for (const test of backend.daTests) {
        if (test.id !== id) continue;
        test.results = [
          {
            id: test.results?.[0]?.id ?? "da-result-1",
            da_test_id: id,
            screening_result: payload.screeningResult ?? test.results?.[0]?.screening_result,
            confirmation_result: payload.confirmationResult ?? null,
            confirmed: payload.confirmed ?? false,
          },
        ];
        if (payload.confirmed) test.status = "FINALIZED";
      }
      return json(route, 201, envelope({ ok: true }));
    }

    // ----shell -----------------------------------------------------------
    if (method === "GET" && path === "/notifications") {
      return json(route, 200, envelope([]));
    }
    if (method === "GET" && path === "/iam/users") {
      return json(route, 200, envelope([], { page: 1, limit: 1, total: 0, totalPages: 1 }));
    }
    if (method === "GET" && path === "/patients") {
      return json(route, 200, envelope([], { page: 1, limit: 100, total: 0, totalPages: 1 }));
    }

    // ---- Default ---------------------------------------------------------
    if (method === "GET") return json(route, 200, envelope([]));
    return json(route, 200, envelope({}));
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const raw = request.postData();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Mapping username E2E -> kode role backend (lihat BACKEND_ROLE_MAP). */
export function rolesForUsername(username: string): string[] {
  const map: Record<string, string[]> = {
    "admin.sistem": ["SYSTEM_ADMIN"],
    "hr.pic": ["HR_ADMIN"],
    "lab.analis": ["LAB_ANALYST"],
    "apoteker": ["PHARMACIST"],
    "dokter.oh": ["DOCTOR_OH"],
    "dokter.klinik": ["DOCTOR_CLINIC"],
    "hse.officer": ["HSE_OFFICER"],
    "manajemen": ["MANAGEMENT"],
    "perawat": ["NURSE"],
  };
  return map[username] ?? ["HR_ADMIN"];
}
