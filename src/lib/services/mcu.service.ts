import { apiClient } from "@/lib/api-client";

export type FtwStatus = "FIT_TO_WORK" | "FIT_WITH_RESTRICTION" | "UNFIT_FOR_WORK";
export type McuType = "ANNUAL_PERIODIC" | "PRE_EMPLOYMENT" | "RETURN_TO_WORK" | "SPECIAL_EXAM";

export interface McuCycle {
  id: string;
  patientId: string;
  patientName: string;
  mcuType: McuType;
  examinationDate: string;
  ftwStatus?: FtwStatus;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ASSESSED";
  createdAt: string;
}

export interface McuListParams {
  page?: number;
  limit?: number;
  ftwStatus?: FtwStatus;
}

export const mcuService = {
  async list(params: McuListParams = {}): Promise<{ data: McuCycle[]; total: number }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.ftwStatus) query.set("ftwStatus", params.ftwStatus);
    const qs = query.toString();
    return apiClient.get<{ data: McuCycle[]; total: number }>(`/mcu/cycles${qs ? `?${qs}` : ""}`);
  },

  async create(patientId: string, mcuType: McuType, examinationDate: string): Promise<McuCycle> {
    return apiClient.post<McuCycle>("/mcu/cycles", { patientId, mcuType, examinationDate });
  },

  async calculate(
    cycleId: string,
    parameters: Record<string, unknown>
  ): Promise<{ bmi?: number; category?: string; recommendations?: string[] }> {
    return apiClient.post(`/mcu/cycles/${cycleId}/calculate`, { parameters });
  },

  async assessFtw(
    cycleId: string,
    ftwStatus: FtwStatus,
    summary?: string,
    restriction?: { description: string; reviewDate: string; supervisor?: string; controls?: string }
  ): Promise<McuCycle> {
    return apiClient.post<McuCycle>(`/mcu/cycles/${cycleId}/ftw-assessment`, {
      ftwStatus,
      summary,
      restriction,
    });
  },

  async acknowledgeRestriction(
    restrictionId: string,
    acknowledgementType: "HSE" | "HR" | "SUPERVISOR",
    note?: string
  ): Promise<{ success: boolean }> {
    return apiClient.post(`/mcu/restrictions/${restrictionId}/acknowledge`, {
      acknowledgementType,
      note,
    });
  },

  async closeRestriction(restrictionId: string): Promise<{ success: boolean }> {
    return apiClient.post(`/mcu/restrictions/${restrictionId}/close`, {});
  },
};
