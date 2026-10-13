import { apiClient } from "@/lib/api-client";
import { resolveScope } from "./reference.service";
import type {
  ConsentStatus,
  CreatePersonDraft,
  CreatedPersonResult,
  DuplicateCheckInput,
  DuplicateCheckResult,
  ListPeopleParams,
  Paginated,
  Person,
  PersonListItem,
} from "@/features/people/api/people.types";

/**
 * Modul 2 — Master Patient Index (MPI) & Digital Consent.
 * Endpoint backend (Domain 2):
 *   POST /api/v1/patients
 *   GET  /api/v1/patients?page=&limit=&search=
 *   GET  /api/v1/patients/:id/profile
 *   POST /api/v1/consents/send
 *   POST /api/v1/public/consents/verify
 */

interface BackendListRow {
  id: string;
  mrn: string;
  fullName: string;
  employeeNo: string;
  site?: string;
  orgUnit?: string;
  sex?: string;
  birthDate?: string;
  maskedIdentifier?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BackendProfile {
  id: string;
  medical_record_no: string;
  full_name: string;
  birth_date?: string;
  sex?: string;
  created_at?: string;
  updated_at?: string;
  employee?: {
    id?: string;
    employee_no?: string;
    full_name?: string;
    birth_date?: string;
    email?: string;
    phone?: string;
    join_date?: string;
    created_at?: string;
    organization?: { id?: string; name?: string };
    org_unit?: { id?: string; name?: string };
    site?: { id?: string; code?: string; name?: string };
    job_task?: { id?: string; name?: string };
  };
  identifiers?: Array<{ identifier_type?: string; identifier_last4?: string }>;
}

interface BackendCreateResult {
  id: string;
  medicalRecordNo: string;
  fullName: string;
  employeeNo: string;
  maskedIdentifier: string;
}

interface BackendConsentResult {
  consentId?: string;
  recipient?: string;
  verificationToken?: string;
  message?: string;
  status?: string;
  consentStatus?: string;
  verifiedAt?: string;
}

/** GRANTED/REVOKED (backend) -> status yang dipahami UI frontend. */
function mapConsentStatus(status?: string): ConsentStatus {
  switch ((status ?? "").toUpperCase()) {
    case "GRANTED":
      return "APPROVED";
    case "REVOKED":
      return "REJECTED";
    case "PENDING":
      return "PENDING";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

function mapProfile(p: BackendProfile): Person {
  const emp = p.employee ?? {};
  const identifier = p.identifiers?.[0];
  return {
    id: p.id,
    fullName: p.full_name ?? emp.full_name ?? "",
    mrn: p.medical_record_no,
    employeeNo: emp.employee_no ?? "",
    identifierType: (identifier?.identifier_type as Person["identifierType"]) ?? "NIK",
    identifierValue: identifier?.identifier_last4
      ? `****${identifier.identifier_last4}`
      : "",
    birthDate: (p.birth_date ?? emp.birth_date ?? "").slice(0, 10),
    sex: p.sex === "F" ? "FEMALE" : "MALE",
    organizationId: emp.organization?.id ?? "",
    organizationName: emp.organization?.name ?? "",
    orgUnitId: emp.org_unit?.id ?? "",
    orgUnitName: emp.org_unit?.name ?? "",
    siteId: emp.site?.id ?? "",
    siteName: emp.site?.name ?? "",
    jobTaskId: emp.job_task?.id,
    jobTaskName: emp.job_task?.name,
    employmentStatus: "ACTIVE",
    joinDate: (emp.join_date ?? emp.created_at ?? "").slice(0, 10),
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    emergencyContact: { name: "", relationship: "", phone: "" },
    documents: [],
    createdAt: p.created_at ?? "",
    updatedAt: p.updated_at ?? "",
  };
}

function mapListItem(p: BackendListRow): PersonListItem {
  return {
    id: p.id,
    fullName: p.fullName,
    mrn: p.mrn,
    employeeNo: p.employeeNo,
    organizationName: "",
    unitName: p.orgUnit ?? "",
    siteName: p.site ?? "",
    emailMasked: "",
    employmentStatus: "ACTIVE",
    // Endpoint list backend tidak menyertakan status consent
    consentStatus: "PENDING",
    updatedAt: p.updated_at ?? "",
    sex: p.sex === "M" || p.sex === "F" ? p.sex : undefined,
    birthDate: p.birthDate ? p.birthDate.slice(0, 10) : undefined,
    maskedIdentifier: p.maskedIdentifier ?? null,
  };
}

export const patientService = {
  async list(params: ListPeopleParams): Promise<Paginated<PersonListItem>> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("limit", String(params.pageSize));
    const qs = query.toString();
    const res = await apiClient.getPaged<BackendListRow[]>(
      `/patients${qs ? `?${qs}` : ""}`
    );
    const meta = res.meta;
    return {
      data: (res.data ?? []).map(mapListItem),
      total: meta?.total ?? (res.data ?? []).length,
      page: meta?.page ?? params.page ?? 1,
      pageSize: meta?.limit ?? params.pageSize ?? 20,
      totalPages: meta?.totalPages ?? 1,
    };
  },

  async getProfile(patientId: string): Promise<Person> {
    const profile = await apiClient.get<BackendProfile>(
      `/patients/${patientId}/profile`
    );
    return mapProfile(profile);
  },

  async create(draft: CreatePersonDraft): Promise<CreatedPersonResult> {
    // Cakupan organisasi/site diambil dari akun yang login (FK wajib valid)
    const scope = await resolveScope();

    const created = await apiClient.post<BackendCreateResult>("/patients", {
      employeeNo: draft.employeeNo,
      fullName: draft.fullName,
      birthDate: draft.birthDate,
      sex: draft.sex === "MALE" ? "M" : "F",
      email: draft.email,
      phone: draft.phone,
      organizationId: scope.organizationId,
      orgUnitId: scope.orgUnitId,
      siteId: scope.siteId,
      siteCode: scope.siteCode,
      identifierType: draft.identifierType,
      identifierValue: draft.identifierValue,
    });

    // Kirim consent digital (POST /consents/send) -> token verifikasi publik
    let consent: BackendConsentResult = {};
    let deliveryStatus: CreatedPersonResult["deliveryStatus"] = "SIMULATED_FAILED";
    let deliveryError: string | undefined;
    try {
      consent = await apiClient.post<BackendConsentResult>("/consents/send", {
        patientId: created.id,
        // Harus salah satu enum ConsentType backend; nilai lain -> error dari server.
        consentType: draft.consentType || "DATA_PROCESSING",
      });
      deliveryStatus = "SIMULATED_SENT";
    } catch (e) {
      deliveryStatus = "SIMULATED_FAILED";
      // Jangan sembunyikan kegagalan: UI wajib tahu consent TIDAK terkirim.
      deliveryError = e instanceof Error ? e.message : "Permintaan consent gagal dikirim.";
    }

    return {
      patientId: created.id,
      employeeId: created.employeeNo,
      mrn: created.medicalRecordNo,
      consentId: consent.consentId ?? "",
      consentStatus: deliveryStatus === "SIMULATED_SENT" ? "PENDING" : "DELIVERY_FAILED",
      consentLink: consent.verificationToken
        ? `${window.location.origin}/public/consent/${consent.verificationToken}`
        : "",
      deliveryStatus,
      deliveryError,
    };
  },

  async duplicateCheck(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    const result = await patientService.list({
      search: input.identifierValue,
      pageSize: 1,
    });
    const existing = result.data[0];
    if (!existing) {
      return { isDuplicate: false, severity: "NONE", message: "Identifier tersedia." };
    }
    return {
      isDuplicate: true,
      severity: existing.employmentStatus === "ACTIVE" ? "BLOCK" : "WARNING",
      message:
        existing.employmentStatus === "ACTIVE"
          ? "Identifier ini sudah terdaftar sebagai pekerja aktif."
          : "Identifier terdeteksi sudah digunakan.",
      existingPerson: {
        id: existing.id,
        fullName: existing.fullName,
        mrn: existing.mrn,
        employeeNo: existing.employeeNo,
        employmentStatus: existing.employmentStatus,
      },
    };
  },

  async sendConsent(
    patientId: string,
    consentType: string
  ): Promise<{
    success: boolean;
    message?: string;
    consentId?: string;
    consentLink?: string;
    deliveryStatus: CreatedPersonResult["deliveryStatus"];
    deliveryError?: string;
  }> {
    try {
      const res = await apiClient.post<BackendConsentResult>("/consents/send", {
        patientId,
        consentType: consentType || "DATA_PROCESSING",
      });
      return {
        success: true,
        message: res.message,
        consentId: res.consentId,
        consentLink: res.verificationToken
          ? `${typeof window === "undefined" ? "" : window.location.origin}/public/consent/${res.verificationToken}`
          : undefined,
        deliveryStatus: "SIMULATED_SENT",
      };
    } catch (e) {
      return {
        success: false,
        deliveryStatus: "SIMULATED_FAILED",
        deliveryError: e instanceof Error ? e.message : "Permintaan consent gagal dikirim.",
      };
    }
  },

  async verifyConsent(
    token: string,
    action: string
  ): Promise<{ success: boolean; status: ConsentStatus }> {
    const res = await apiClient.post<BackendConsentResult>(
      "/public/consents/verify",
      { token, action }
    );
    return {
      success: (res.status ?? "SUCCESS") === "SUCCESS",
      status: mapConsentStatus(res.consentStatus),
    };
  },
};
