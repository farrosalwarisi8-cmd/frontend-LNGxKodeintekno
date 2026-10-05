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
  PeopleService,
} from "./people.types";

export const peopleRepository: PeopleService = {
  async listPeople(params: ListPeopleParams): Promise<Paginated<PersonListItem>> {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("limit", String(params.pageSize));

    const qs = query.toString();
    return apiClient.get<Paginated<PersonListItem>>(`/patients${qs ? `?${qs}` : ""}`);
  },

  async getPerson(patientId: string): Promise<Person> {
    return apiClient.get<Person>(`/patients/${patientId}/profile`);
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
          ? "Identifier ini sudah terdaftar sebagai pekerja aktif. Periksa kembali data atau buka profil yang sudah ada."
          : "Identifier terdeteksi sudah digunakan. Record yang sama ditemukan dalam scope Anda.",
      existingPerson: {
        id: existing.id,
        fullName: existing.fullName,
        mrn: existing.mrn,
        employeeNo: existing.employeeNo,
        employmentStatus: existing.employmentStatus,
      },
    };
  },

  async createPerson(input: CreatePersonDraft): Promise<CreatedPersonResult> {
    return apiClient.post<CreatedPersonResult>("/patients", {
      employeeNo: input.employeeNo,
      fullName: input.fullName,
      birthDate: input.birthDate,
      sex: input.sex === "MALE" ? "M" : "F",
      email: input.email,
      phone: input.phone,
      organizationId: input.organizationId,
      orgUnitId: input.orgUnitId,
      siteId: input.siteId,
      jobTaskId: input.jobTaskId,
      identifierType: input.identifierType,
      identifierValue: input.identifierValue,
    });
  },

  async resendConsent(patientId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>("/consents/send", {
      patientId,
      consentType: "DATA_PROCESSING",
    });
  },

  async decideConsent(
    token: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<{ success: boolean; status: ConsentStatus }> {
    return apiClient.post<{ success: boolean; status: ConsentStatus }>(
      "/public/consents/verify",
      { token, action: decision === "APPROVED" ? "AGREED" : "DECLINED" }
    );
  },
};
