import { apiClient } from "@/lib/api-client";

export interface QueueTicket {
  id: string;
  ticketNumber: string;
  patientId: string;
  patientName: string;
  siteId: string;
  status: "WAITING" | "CALLED" | "IN_SERVICE" | "COMPLETED";
  createdAt: string;
}

export interface Encounter {
  id: string;
  patientId: string;
  patientName: string;
  siteId: string;
  doctorId: string;
  status: "OPEN" | "IN_PROGRESS" | "FINALIZED";
  vitals?: {
    heightCm: number;
    weightKg: number;
    systolicBp?: number;
    diastolicBp?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    bmi?: number;
  };
  soap?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    primaryIcd10?: string;
  };
  createdAt: string;
}

export interface Icd10Code {
  code: string;
  name: string;
}

export const encounterService = {
  async getQueues(siteId?: string): Promise<QueueTicket[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<QueueTicket[]>(`/clinic/queues${qs}`);
  },

  async callNextTicket(counterId: string, ticketId?: string): Promise<QueueTicket> {
    return apiClient.post<QueueTicket>("/clinic/queues/call", { counterId, ticketId });
  },

  async openEncounter(patientId: string, appointmentId?: string): Promise<Encounter> {
    return apiClient.post<Encounter>("/clinic/encounters", { patientId, appointmentId });
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
  ): Promise<Encounter> {
    return apiClient.put<Encounter>(`/clinic/encounters/${encounterId}/vitals`, vitals);
  },

  async saveSoap(
    encounterId: string,
    soap: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      primaryIcd10?: string;
    }
  ): Promise<Encounter> {
    return apiClient.put<Encounter>(`/clinic/encounters/${encounterId}/soap`, soap);
  },

  async finalize(encounterId: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/clinic/encounters/${encounterId}/finalize`, {});
  },

  async addendum(encounterId: string, reason: string, addendumNote: string): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>(`/clinic/encounters/${encounterId}/addendum`, {
      reason,
      addendumNote,
    });
  },

  async searchIcd10(keyword: string): Promise<Icd10Code[]> {
    return apiClient.get<Icd10Code[]>(`/clinic/icd10/search?keyword=${encodeURIComponent(keyword)}`);
  },
};
