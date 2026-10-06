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
import { patientService } from "@/lib/services/patient.service";

/**
 * Repository Modul 2 (Registrasi Pekerja, MRN, Consent).
 * Seluruh implementasi didelegasikan ke `patientService` sehingga hanya ada
 * satu tempat pemetaan response backend -> tipe frontend.
 */
export const peopleRepository: PeopleService = {
  listPeople(params: ListPeopleParams): Promise<Paginated<PersonListItem>> {
    return patientService.list(params);
  },

  getPerson(patientId: string): Promise<Person> {
    return patientService.getProfile(patientId);
  },

  duplicateCheck(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    return patientService.duplicateCheck(input);
  },

  createPerson(input: CreatePersonDraft): Promise<CreatedPersonResult> {
    return patientService.create(input);
  },

  async resendConsent(patientId: string): Promise<{ success: boolean; message: string }> {
    const res = await patientService.sendConsent(patientId, "DATA_PROCESSING");
    return { success: res.success, message: res.message ?? "Permintaan consent dikirim ulang." };
  },

  decideConsent(
    token: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<{ success: boolean; status: ConsentStatus }> {
    return patientService.verifyConsent(
      token,
      decision === "APPROVED" ? "AGREED" : "DECLINED"
    );
  },
};
