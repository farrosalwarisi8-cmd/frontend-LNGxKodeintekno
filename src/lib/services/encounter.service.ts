import { apiClient } from "@/lib/api-client";

/**
 * Modul 3 — Klinik Rawat Jalan (Rawat Jalan / SOAP).
 * Endpoint backend (Domain 3):
 *   GET  /api/v1/clinic/queues?siteId=
 *   POST /api/v1/clinic/queues
 *   POST /api/v1/clinic/queues/call
 *   GET  /api/v1/clinic/encounters?patientId=&status=&siteId=&page=&limit=
 *   GET  /api/v1/clinic/encounters/:id
 *   POST /api/v1/clinic/encounters
 *   PUT  /api/v1/clinic/encounters/:id/vitals
 *   PUT  /api/v1/clinic/encounters/:id/soap
 *   POST /api/v1/clinic/encounters/:id/finalize
 *   POST /api/v1/clinic/encounters/:id/addendum
 *   GET  /api/v1/clinic/encounters/:id/outside-treatments
 *   POST /api/v1/clinic/encounters/:id/outside-treatments
 *   GET  /api/v1/clinic/icd10/search?keyword=
 */

export interface BackendPatientRef {
  id: string;
  medical_record_no?: string;
  full_name?: string;
}

export interface BackendQueueTicket {
  id: string;
  appointment_id: string;
  counter_id?: string | null;
  ticket_no: string;
  priority_score?: number;
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED" | "CANCELLED" | string;
  created_at?: string;
  called_at?: string | null;
  appointment?: {
    id?: string;
    patient_id?: string;
    scheduled_at?: string;
    visit_type?: string;
    patient?: BackendPatientRef;
  };
  counter?: { id?: string; name?: string; code?: string } | null;
}

export interface BackendEncounter {
  id: string;
  patient_id: string;
  appointment_id?: string | null;
  attending_user_id?: string | null;
  status: string;
  started_at?: string;
  finalized_at?: string | null;
  locked_at?: string | null;
}

export interface BackendVitalSign {
  encounter_id?: string;
  height_cm?: number;
  weight_kg?: number;
  bmi?: number;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  spo2?: number | null;
}

export interface BackendSoapNote {
  encounter_id?: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  status?: string;
}

export interface Icd10Code {
  id?: string;
  code: string;
  description?: string;
  name?: string;
}

export interface BackendOutsideTreatment {
  id: string;
  encounter_id?: string | null;
  provider_name?: string | null;
  diagnosis?: string | null;
  therapy?: string | null;
  cost_idr?: number | null;
  sick_letter_no?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const encounterService = {
  async getQueues(siteId?: string): Promise<BackendQueueTicket[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<BackendQueueTicket[]>(`/clinic/queues${qs}`);
  },

  async createQueueTicket(input: {
    appointmentId?: string;
    patientId?: string;
    siteId?: string;
    priorityScore?: number;
    counterId?: string;
  }): Promise<BackendQueueTicket> {
    return apiClient.post<BackendQueueTicket>("/clinic/queues", input);
  },

  async callNextTicket(counterId: string, ticketId?: string): Promise<BackendQueueTicket> {
    return apiClient.post<BackendQueueTicket>("/clinic/queues/call", { counterId, ticketId });
  },

  async listEncounters(params?: {
    patientId?: string;
    status?: string;
    siteId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: BackendEncounter[]; meta?: { page: number; limit: number; total: number; totalPages: number } }> {
    const qs = new URLSearchParams();
    if (params?.patientId) qs.set("patientId", params.patientId);
    if (params?.status) qs.set("status", params.status);
    if (params?.siteId) qs.set("siteId", params.siteId);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await apiClient.getPaged<BackendEncounter[]>(
      `/clinic/encounters${query ? `?${query}` : ""}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async getEncounter(id: string): Promise<BackendEncounter> {
    return apiClient.get<BackendEncounter>(`/clinic/encounters/${id}`);
  },

  async openEncounter(patientId: string, appointmentId?: string): Promise<BackendEncounter> {
    return apiClient.post<BackendEncounter>("/clinic/encounters", { patientId, appointmentId });
  },

  async recordVitals(
    encounterId: string,
    vitals: {
      heightCm: number;
      weightKg: number;
      systolicBp?: number;
      diastolicBp?: number;
      pulse?: number;
      temperature?: number;
      spo2?: number;
    }
  ): Promise<BackendVitalSign> {
    return apiClient.put<BackendVitalSign>(`/clinic/encounters/${encounterId}/vitals`, vitals);
  },

  async saveSoap(
    encounterId: string,
    soap: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      primaryIcd10?: string;
      secondaryIcd10Codes?: string[];
    }
  ): Promise<BackendSoapNote> {
    return apiClient.put<BackendSoapNote>(`/clinic/encounters/${encounterId}/soap`, soap);
  },

  async finalize(encounterId: string): Promise<BackendEncounter> {
    return apiClient.post<BackendEncounter>(`/clinic/encounters/${encounterId}/finalize`);
  },

  async addendum(
    encounterId: string,
    reason: string,
    addendumNote: string
  ): Promise<{ encounterId: string; addendumId: string; message: string }> {
    return apiClient.post(`/clinic/encounters/${encounterId}/addendum`, {
      reason,
      addendumNote,
    });
  },

  async searchIcd10(keyword: string): Promise<Icd10Code[]> {
    return apiClient.get<Icd10Code[]>(
      `/clinic/icd10/search?keyword=${encodeURIComponent(keyword)}`
    );
  },

  async listOutsideTreatments(encounterId: string): Promise<BackendOutsideTreatment[]> {
    return apiClient.get<BackendOutsideTreatment[]>(
      `/clinic/encounters/${encounterId}/outside-treatments`
    );
  },

  async addOutsideTreatment(
    encounterId: string,
    input: {
      providerName: string;
      diagnosis?: string;
      therapy?: string;
      costIdr?: number;
      sickLetterNo?: string;
    }
  ): Promise<BackendOutsideTreatment> {
    return apiClient.post<BackendOutsideTreatment>(
      `/clinic/encounters/${encounterId}/outside-treatments`,
      input
    );
  },

  async listAllOutsideTreatments(params?: {
    encounterId?: string;
    patientId?: string;
    providerName?: string;
    hasSickLetter?: boolean;
    page?: number;
    limit?: number;
  }): Promise<BackendOutsideTreatment[]> {
    const qs = new URLSearchParams();
    if (params?.encounterId) qs.set("encounterId", params.encounterId);
    if (params?.patientId) qs.set("patientId", params.patientId);
    if (params?.providerName) qs.set("providerName", params.providerName);
    if (params?.hasSickLetter !== undefined) qs.set("hasSickLetter", String(params.hasSickLetter));
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return apiClient.get<BackendOutsideTreatment[]>(
      `/clinic/outside-treatments${query ? `?${query}` : ""}`
    );
  },
};
