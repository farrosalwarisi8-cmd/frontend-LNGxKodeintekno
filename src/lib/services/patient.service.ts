import { apiClient } from "@/lib/api-client";
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

export const patientService = {
  async list(params: ListPeopleParams): Promise<Paginated<PersonListItem>> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("limit", String(params.pageSize));
    const qs = query.toString();
    return apiClient.get<Paginated<PersonListItem>>(`/patients${qs ? `?${qs}` : ""}`);
  },

  async getProfile(patientId: string): Promise<Person> {
    return apiClient.get<Person>(`/patients/${patientId}/profile`);
  },

  async create(draft: CreatePersonDraft): Promise<CreatedPersonResult> {
    return apiClient.post<CreatedPersonResult>("/patients", {
      employeeNo: draft.employeeNo,
      fullName: draft.fullName,
      birthDate: draft.birthDate,
      sex: draft.sex === "MALE" ? "M" : "F",
      email: draft.email,
      phone: draft.phone,
      organizationId: draft.organizationId,
      orgUnitId: draft.orgUnitId,
      siteId: draft.siteId,
      jobTaskId: draft.jobTaskId,
      identifierType: draft.identifierType,
      identifierValue: draft.identifierValue,
    });
  },

  async duplicateCheck(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    const result = await apiClient.get<Paginated<PersonListItem>>(
      `/patients?search=${encodeURIComponent(input.identifierValue)}&limit=1`
    );
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

  async sendConsent(patientId: string, consentType: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/consents/send", { patientId, consentType });
  },

  async verifyConsent(token: string, action: string): Promise<{ success: boolean; status: ConsentStatus }> {
    return apiClient.post<{ success: boolean; status: ConsentStatus }>("/public/consents/verify", {
      token,
      action,
    });
  },
};
