/**
 * Mock backend untuk E2E alur mutasi.
 *
 * Backend MOCK dijalankan di dalam browser (Playwright `page.route`) — bukan
 * backend baru dan bukan server sungguhan. Tujuannya membuktikan perilaku
 * frontend (form, konfirmasi, state sukses/gagal, pembatasan permission)
 * tanpa bergantung pada backend yang belum siap.
 *
 * Aturan:
 *  - Setiap test membuat state-nya sendiri (factory di bawah), sehingga tidak
 *    bergantung pada urutan test.
 *  - Tidak ada kredensial nyata: username/password E2E adalah string tetap
 *    yang hanya hidup di memory browser.
 *  - `backend.fail("POST /patients", 500)` membuat endpoint tertentu gagal
 *    untuk menguji jalur error.
 */
import type { Page, Request, Route } from "@playwright/test";

export interface MockCall {
  method: string;
  path: string;
}

export interface MockBackend {
  calls: MockCall[];
  /** key = "METHOD /path" -> status HTTP untuk simulasi kegagalan. */
  failures: Map<string, number>;
  patients: MockPatient[];
  waivers: MockWaiver[];
  organizations: MockOrganization[];
  departments: MockDepartment[];
  sites: MockSite[];
  prescriptions: MockPrescription[];
  inventory: MockInventoryItem[];
  batches: MockBatch[];
  dispensings: MockDispensing[];
  queue: MockQueueTicket[];
  encounters: Map<string, MockEncounter>;
  /** Encounter yang dikembalikan ketika frontend membuka encounter (POST /clinic/encounters). */
  encounterIdForVisit?: string;
  /** Username akun yang sedang login (dipakai mock /iam/users). */
  currentUsername?: string;
  fail: (key: string, status?: number) => void;
  callsTo: (method: string, path: string) => number;
}

export interface MockPatient {
  id: string;
  mrn: string;
  fullName: string;
  employeeNo: string;
  site?: string;
  orgUnit?: string;
  sex?: string;
  birthDate?: string;
  maskedIdentifier?: string | null;
  employmentStatus?: string;
  /**
   * Identifier mentah (mis. NIK). Backend mencocokkan `GET /patients?search=`
   * di sisi server atas nilai mentah, sementara responsnya tetap memakai
   * `maskedIdentifier`. Field ini hanya dipakai mock untuk menirukan
   * perilaku tersebut.
   */
  nationalId?: string;
}

export interface MockWaiver {
  id: string;
  visitor_name: string;
  company?: string | null;
  purpose: string;
  valid_until: string;
  status: string;
  decision?: "APPROVED" | "REJECTED";
  lifecycle?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  site?: { id?: string; code?: string; name?: string } | null;
  waiver_consent?: { id: string; email: string } | null;
}

export interface MockOrganization {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface MockDepartment {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  active: boolean;
  organization?: { code: string; name: string };
}

export interface MockSite {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  site_type?: string;
  address?: string | null;
  active: boolean;
  org_unit?: { code: string; name: string; organization?: { code: string; name: string } };
}

export interface MockPrescription {
  id: string;
  encounter_id: string;
  status: string;
  prescribed_at: string;
  encounter?: {
    id: string;
    patient?: { id: string; full_name: string; medical_record_no: string };
  };
  items: Array<{
    id: string;
    medication_id: string;
    quantity: number;
    dosage: string;
    medication?: { id: string; code: string; generic_name: string; strength: string };
  }>;
}

export interface MockInventoryItem {
  id: string;
  medicationCode: string;
  genericName: string;
  strength?: string;
  dosageForm?: string;
  siteName: string;
  currentStock: number;
  minimumStock: number;
  isLowStock: boolean;
  activeBatchesCount: number;
  nearestExpiryDate?: string | null;
}

export interface MockBatch {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  available: number;
  medicationId: string;
}

export interface MockDispensing {
  id: string;
  prescription_id: string;
  status: string;
  dispensed_at: string;
  dispensed_by: string;
  prescription?: {
    id: string;
    encounter_id: string;
    encounter?: {
      id: string;
      patient?: { id: string; full_name: string; medical_record_no: string };
    };
    items: Array<{
      id: string;
      medication_id: string;
      quantity: number;
      medication?: { id: string; code: string; generic_name: string };
    }>;
  };
  dispensing_items: Array<{
    id: string;
    stock_batch_id: string;
    quantity: number;
    stock_batch?: { id: string; batch_no: string; expiry_date: string; quantity_available: number };
  }>;
  medication_returns: Array<{
    id: string;
    dispensing_id: string;
    stock_batch_id: string;
    quantity: number;
    reason: string;
    returned_at: string;
  }>;
}

export interface MockQueueTicket {
  id: string;
  ticket_no: string;
  status: string;
  created_at: string;
  appointment?: {
    id: string;
    patient?: { id: string; full_name: string; medical_record_no: string };
  };
}

export interface MockEncounter {
  id: string;
  patient_id: string;
  status: string;
  soap?: Record<string, unknown> | null;
  addenda: Array<{ id: string; reason: string; addendumNote: string; created_at: string }>;
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
    error: status === 409 ? "Conflict" : "Internal Server Error",
    message,
    timestamp: new Date().toISOString(),
  };
}

/** JWT palsu (payload base64) — dipakai resolveScope untuk organizationId. */
export function fakeJwt(organizationId = "org-1", username = "e2e"): string {
  const payload = Buffer.from(
    JSON.stringify({ organizationId, sub: "e2e", username })
  ).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.e2e-signature`;
}

export function createMockBackend(): MockBackend {
  return {
    calls: [],
    failures: new Map(),
    patients: [],
    waivers: [],
    organizations: [],
    departments: [],
    sites: [],
    prescriptions: [],
    inventory: [],
    batches: [],
    dispensings: [],
    queue: [],
    encounters: new Map(),
    encounterIdForVisit: undefined,
    currentUsername: undefined,
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

/**
 * Pasang interceptor untuk seluruh `/api/v1/**`.
 * Mengembalikan handle untukepas interceptor bila perlu.
 */
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
      backend.currentUsername = username;
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

    // ---- IAM -------------------------------------------------------------
    if (method === "GET" && path === "/iam/users") {
      return json(
        route,
        200,
        envelope(
          [
            {
              id: "user-1",
              username: backend.currentUsername ?? "e2e",
              user_roles: [
                {
                  org_unit_id: "unit-1",
                  site: { id: "site-1", code: "SITE-A", name: "Site A" },
                  role: { code: "SYSTEM_ADMIN" },
                },
              ],
            },
          ],
          { page: 1, limit: 1, total: 1, totalPages: 1 }
        )
      );
    }
    if (method === "GET" && path === "/iam/audit-logs") {
      return json(route, 200, envelope([], { page: 1, limit: 50, total: 0, totalPages: 1 }));
    }

    // ---- Patient (MPI) --------------------------------------------------
    if (method === "GET" && path === "/patients") {
      const search = url.searchParams.get("search") ?? "";
      const matched = search
        ? backend.patients.filter(
            (p) =>
              p.mrn.toLowerCase().includes(search.toLowerCase()) ||
              p.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
              p.fullName.toLowerCase().includes(search.toLowerCase()) ||
              (p.nationalId ?? "").toLowerCase().includes(search.toLowerCase())
          )
        : backend.patients;
      return json(
        route,
        200,
        envelope(matched, { page: 1, limit: 100, total: matched.length, totalPages: 1 })
      );
    }
    if (method === "POST" && path === "/patients") {
      const input = (body ?? {}) as { fullName?: string; employeeNo?: string };
      const created: MockPatient = {
        id: `patient-${backend.patients.length + 1}`,
        mrn: `MRN-E2E-${String(backend.patients.length + 1).padStart(4, "0")}`,
        fullName: input.fullName ?? "Pekerja E2E",
        employeeNo: input.employeeNo ?? "EMP-E2E",
        site: "Site A",
        orgUnit: "Unit A",
        sex: "M",
        birthDate: "1990-01-01",
        maskedIdentifier: "****0001",
        employmentStatus: "ACTIVE",
      };
      backend.patients.push(created);
      return json(
        route,
        201,
        envelope({
          id: created.id,
          medicalRecordNo: created.mrn,
          fullName: created.fullName,
          employeeNo: created.employeeNo,
          maskedIdentifier: created.maskedIdentifier,
        })
      );
    }
    if (method === "POST" && path === "/consents/send") {
      return json(
        route,
        201,
        envelope({
          consentId: `consent-${backend.calls.length}`,
          recipient: "e2e@perusahaan.test",
          verificationToken: "e2e-consent-token",
          status: "SUCCESS",
          consentStatus: "PENDING",
        })
      );
    }

    // ---- Klinik / SOAP --------------------------------------------------
    if (method === "GET" && path === "/clinic/queues") {
      return json(route, 200, envelope(backend.queue));
    }
    if (method === "GET" && path === "/clinic/icd10/search") {
      return json(
        route,
        200,
        envelope([
          { id: "icd-1", code: "J06.9", description: "Infeksi saluran pernapasan atas" },
          { id: "icd-2", code: "M54.5", description: "Nyeri pinggang bawah" },
        ])
      );
    }
    if (method === "POST" && path === "/clinic/encounters") {
      const id = backend.encounterIdForVisit ?? "enc-default";
      const encounter = backend.encounters.get(id) ?? {
        id,
        patient_id: "patient-1",
        status: "IN_SERVICE",
        soap: null,
        addenda: [],
      };
      backend.encounters.set(id, encounter);
      return json(route, 201, envelope(encounter));
    }
    if (method === "PUT" && /^\/clinic\/encounters\/[^/]+\/soap$/.test(path)) {
      const id = path.split("/")[3];
      const encounter = backend.encounters.get(id);
      if (encounter) encounter.soap = body as Record<string, unknown>;
      return json(route, 200, envelope({ encounter_id: id, status: "DRAFT", ...(body as object) }));
    }
    if (method === "POST" && /^\/clinic\/encounters\/[^/]+\/finalize$/.test(path)) {
      const id = path.split("/")[3];
      const encounter = backend.encounters.get(id);
      if (encounter) encounter.status = "LOCKED";
      return json(route, 200, envelope({ id, patient_id: "patient-1", status: "LOCKED" }));
    }
    if (method === "POST" && /^\/clinic\/encounters\/[^/]+\/addendum$/.test(path)) {
      const id = path.split("/")[3];
      const encounter = backend.encounters.get(id);
      const addendum = {
        id: `addendum-${(encounter?.addenda.length ?? 0) + 1}`,
        reason: (body as { reason?: string })?.reason ?? "",
        addendumNote: (body as { addendumNote?: string })?.addendumNote ?? "",
        created_at: new Date().toISOString(),
      };
      encounter?.addenda.push(addendum);
      return json(
        route,
        201,
        envelope({ encounterId: id, addendumId: addendum.id, message: "Addendum tersimpan." })
      );
    }

    // ---- MCU -------------------------------------------------------------
    if (method === "GET" && path === "/mcu/cycles") {
      return json(
        route,
        200,
        envelope([], { page: 1, limit: 100, total: 0, totalPages: 1 })
      );
    }

    // ---- Farmasi ---------------------------------------------------------
    if (method === "GET" && path === "/pharmacy/inventory") {
      return json(route, 200, envelope(backend.inventory));
    }
    if (method === "GET" && path === "/pharmacy/prescriptions/pending") {
      return json(route, 200, envelope(backend.prescriptions));
    }
    if (method === "POST" && path === "/pharmacy/dispensing/recommend-batches") {
      const payload = (body ?? {}) as { medicationId: string; requiredQuantity: number };
      const batches = backend.batches
        .filter((b) => b.medicationId === payload.medicationId)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)); // FEFO
      const recommendedBatches: Array<{
        batchId: string;
        batchNo: string;
        expiryDate: string;
        available: number;
        allocated: number;
      }> = [];
      let remaining = payload.requiredQuantity ?? 0;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const allocated = Math.min(batch.available, remaining);
        remaining -= allocated;
        recommendedBatches.push({
          batchId: batch.batchId,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          available: batch.available,
          allocated,
        });
      }
      return json(
        route,
        200,
        envelope({
          medicationId: payload.medicationId,
          siteId: "site-1",
          requiredQuantity: payload.requiredQuantity ?? 0,
          isFullyAllocatable: remaining <= 0,
          shortfall: Math.max(remaining, 0),
          recommendedBatches,
        })
      );
    }
    if (method === "POST" && path === "/pharmacy/dispensing") {
      const payload = (body ?? {}) as {
        prescriptionId: string;
        allocations: Array<{ stockBatchId: string; quantity: number }>;
      };
      // Stok berkurang mengikuti alokasi yang dikirim frontend.
      for (const allocation of payload.allocations ?? []) {
        const batch = backend.batches.find((b) => b.batchId === allocation.stockBatchId);
        if (batch) batch.available -= allocation.quantity;
        // Item inventaris teridentifikasi lewat obat dari batch yang dipakai.
        const medicationId = batch?.medicationId ?? allocation.stockBatchId;
        const item = backend.inventory.find((i) => i.id === medicationId);
        if (item) item.currentStock -= allocation.quantity;
      }
      const dispensing: MockDispensing = {
        id: `disp-${backend.dispensings.length + 1}`,
        prescription_id: payload.prescriptionId,
        status: "FINAL",
        dispensed_at: new Date().toISOString(),
        dispensed_by: "e2e",
        prescription: undefined,
        dispensing_items: (payload.allocations ?? []).map((a, index) => ({
          id: `disp-item-${index + 1}`,
          stock_batch_id: a.stockBatchId,
          quantity: a.quantity,
          stock_batch: {
            id: a.stockBatchId,
            batch_no: a.stockBatchId,
            expiry_date: "2027-01-01",
            quantity_available: 0,
          },
        })),
        medication_returns: [],
      };
      backend.dispensings.unshift(dispensing);
      backend.prescriptions = backend.prescriptions.filter(
        (p) => p.id !== payload.prescriptionId
      );
      return json(route, 201, envelope({ id: dispensing.id, prescription_id: payload.prescriptionId }));
    }
    if (method === "GET" && path === "/pharmacy/dispensing/history") {
      return json(route, 200, envelope(backend.dispensings));
    }
    if (method === "POST" && path === "/pharmacy/returns") {
      const payload = (body ?? {}) as {
        dispensingId: string;
        stockBatchId: string;
        quantity: number;
        reason: string;
      };
      const dispensing = backend.dispensings.find((d) => d.id === payload.dispensingId);
      dispensing?.medication_returns.push({
        id: `return-${(dispensing?.medication_returns.length ?? 0) + 1}`,
        dispensing_id: payload.dispensingId,
        stock_batch_id: payload.stockBatchId,
        quantity: payload.quantity,
        reason: payload.reason,
        returned_at: new Date().toISOString(),
      });
      const batch = backend.batches.find((b) => b.batchId === payload.stockBatchId);
      if (batch) batch.available += payload.quantity;
      return json(
        route,
        201,
        envelope({ id: `return-${Date.now()}`, dispensingId: payload.dispensingId })
      );
    }

    // ---- Waiver ----------------------------------------------------------
    if (method === "GET" && path === "/waivers") {
      return json(
        route,
        200,
        envelope(backend.waivers, { page: 1, limit: 50, total: backend.waivers.length, totalPages: 1 })
      );
    }
    if (method === "POST" && path === "/waivers") {
      const input = (body ?? {}) as { visitorName?: string; purpose?: string; validUntil?: string };
      const waiver: MockWaiver = {
        id: `waiver-${backend.waivers.length + 1}`,
        visitor_name: input.visitorName ?? "Visitor E2E",
        purpose: input.purpose ?? "Kunjungan E2E",
        valid_until: input.validUntil ?? "2027-01-01",
        status: "PENDING",
        lifecycle: "PENDING",
        site: { id: "site-1", code: "SITE-A", name: "Site A" },
        waiver_consent: null,
      };
      backend.waivers.unshift(waiver);
      return json(route, 201, envelope(waiver));
    }
    if (method === "POST" && /^\/waivers\/[^/]+\/decision$/.test(path)) {
      const id = path.split("/")[2];
      const status = (body as { status?: "APPROVED" | "REJECTED" })?.status ?? "APPROVED";
      const waiver = backend.waivers.find((w) => w.id === id);
      if (waiver) {
        waiver.decision = status;
        waiver.lifecycle = status;
        waiver.status = status === "APPROVED" ? "FINAL" : "VOID";
      }
      return json(route, 200, envelope(waiver));
    }
    if (method === "POST" && /^\/waivers\/[^/]+\/send$/.test(path)) {
      const id = path.split("/")[2];
      const waiver = backend.waivers.find((w) => w.id === id);
      if (waiver) waiver.waiver_consent = { id: `consent-${id}`, email: "host@perusahaan.test" };
      return json(
        route,
        200,
        envelope({ status: "SENT", email: "host@perusahaan.test", expiresAt: "2027-01-01" })
      );
    }
    if (method === "POST" && /^\/waivers\/[^/]+\/revoke$/.test(path)) {
      return json(route, 200, envelope({ status: "REVOKED", revokedAt: new Date().toISOString() }));
    }

    // ---- Master data -----------------------------------------------------
    if (method === "GET" && path === "/master-data/organizations") {
      return json(route, 200, envelope(backend.organizations));
    }
    if (method === "POST" && path === "/master-data/organizations") {
      const input = (body ?? {}) as { code?: string; name?: string };
      const duplicate = backend.organizations.some(
        (o) => o.code.toLowerCase() === (input.code ?? "").toLowerCase()
      );
      if (duplicate) {
        return json(route, 409, errorEnvelope(409, "Kode perusahaan sudah dipakai."));
      }
      const organization: MockOrganization = {
        id: `org-${backend.organizations.length + 1}`,
        code: input.code ?? "ORG",
        name: input.name ?? "Organisasi",
        status: "ACTIVE",
      };
      backend.organizations.push(organization);
      return json(route, 201, envelope(organization));
    }
    if (method === "PATCH" && /^\/master-data\/organizations\/[^/]+$/.test(path)) {
      const id = path.split("/")[3];
      const organization = backend.organizations.find((o) => o.id === id);
      const input = (body ?? {}) as { name?: string };
      if (organization && input.name) organization.name = input.name;
      return json(route, 200, envelope(organization));
    }
    if (method === "PATCH" && /^\/master-data\/organizations\/[^/]+\/status$/.test(path)) {
      const id = path.split("/")[3];
      const organization = backend.organizations.find((o) => o.id === id);
      const input = (body ?? {}) as { status?: "ACTIVE" | "INACTIVE" };
      if (organization && input.status) organization.status = input.status;
      return json(route, 200, envelope(organization));
    }
    if (method === "GET" && path === "/master-data/departments") {
      return json(route, 200, envelope(backend.departments));
    }
    if (method === "GET" && path === "/master-data/sites") {
      return json(route, 200, envelope(backend.sites));
    }

    // ---- Notifikasi & eskalasi -------------------------------------------
    if (method === "GET" && path === "/notifications") {
      return json(route, 200, envelope([]));
    }
    if (method === "POST" && path === "/admin/escalation/run-check") {
      return json(route, 200, envelope({ evaluatedCount: 3, escalatedCount: 1 }));
    }

    // ---- Laporan ---------------------------------------------------------
    if (method === "GET" && path === "/reports/definitions") {
      return json(route, 200, envelope([], { page: 1, limit: 20, total: 0, totalPages: 1 }));
    }
    if (method === "GET" && path === "/analytics/top-diseases") {
      return json(route, 200, envelope({ topDiseases: [] }));
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
    "hse.officer": ["HSE_OFFICER"],
  };
  return map[username] ?? ["HR_ADMIN"];
}
