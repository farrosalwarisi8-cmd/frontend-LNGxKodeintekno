import { apiClient } from "@/lib/api-client";

/**
 * Modul 4 — Occupational Health, Medical Check-Up (MCU) & FTW Engine.
 * Endpoint backend (Domain 4):
 *   POST /api/v1/mcu/cycles
 *   GET  /api/v1/mcu/cycles?page=&limit=&ftwStatus=
 *   POST /api/v1/mcu/cycles/:id/calculate
 *   POST /api/v1/mcu/cycles/:id/ftw-assessment
 *   POST /api/v1/mcu/restrictions/:id/acknowledge
 *   POST /api/v1/mcu/restrictions/:id/close
 *   POST /api/v1/mcu/cycles/bulk-import
 *   GET  /api/v1/mcu/cycles/bulk-import/:jobId/status
 */

/** Enum sesuai skema backend (prisma/schema.prisma). */
export type McuType = "PRE_EMPLOYMENT" | "ANNUAL_PERIODIC" | "SPECIAL_HAZARD" | "OFFSHORE_CLEARANCE" | "POST_ILLNESS";
export type FtwStatus = "FIT" | "FIT_WITH_RESTRICTION" | "TEMPORARILY_UNFIT" | "UNFIT";
export type AcknowledgementType = "HR" | "HSE" | "LINE_MANAGER";

export interface BackendFtwRestriction {
  id: string;
  description?: string;
  effective_date?: string;
  review_date?: string;
  supervisor?: string | null;
  controls?: string | null;
  status?: string;
}

export interface BackendFtwAssessment {
  id: string;
  mcu_cycle_id?: string;
  ftw_status: FtwStatus;
  summary?: string | null;
  assessed_by?: string | null;
  assessed_at?: string;
  valid_until?: string;
  restrictions?: BackendFtwRestriction[];
}

export interface BackendMcuCycle {
  id: string;
  patient_id: string;
  mcu_type: McuType;
  examination_date: string;
  valid_from?: string;
  valid_until?: string;
  status?: string;
  reviewer_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
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
  ftw_assessment?: BackendFtwAssessment | null;
  calculations?: Array<Record<string, unknown>>;
}

/**
 * Response `POST /mcu/restrictions/:id/acknowledge`.
 *
 * `acknowledged_at` berasal dari server (BUKAN waktu lokal) sehingga UI dapat
 * menampilkan timestamp yang benar-benar tercatat backend.
 */
export interface BackendRestrictionAcknowledgement {
  id?: string;
  restriction_id?: string;
  user_id?: string;
  acknowledgement_type?: AcknowledgementType;
  note?: string | null;
  acknowledged_at?: string;
}

export interface McuListParams {
  page?: number;
  limit?: number;
  ftwStatus?: FtwStatus;
  /**
   * Kata kunci pencarian (backend: `GET /mcu/cycles?search=`).
   * Ditambahkan pada A3 untuk antrean review MCU.
   */
  search?: string;
}

export const mcuService = {
  async list(params: McuListParams = {}): Promise<{
    data: BackendMcuCycle[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.ftwStatus) query.set("ftwStatus", params.ftwStatus);
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    const res = await apiClient.getPaged<BackendMcuCycle[]>(
      `/mcu/cycles${qs ? `?${qs}` : ""}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async create(patientId: string, mcuType: McuType, examinationDate: string): Promise<BackendMcuCycle> {
    return apiClient.post<BackendMcuCycle>("/mcu/cycles", {
      patientId,
      mcuType,
      examinationDate,
    });
  },

  async calculate(cycleId: string, parameters: Record<string, unknown>): Promise<unknown> {
    return apiClient.post(`/mcu/cycles/${cycleId}/calculate`, { parameters });
  },

  async assessFtw(
    cycleId: string,
    ftwStatus: FtwStatus,
    summary?: string,
    restriction?: { description: string; reviewDate: string; supervisor?: string; controls?: string }
  ): Promise<{ assessment: BackendFtwAssessment; restriction?: BackendFtwRestriction | null }> {
    return apiClient.post<{ assessment: BackendFtwAssessment; restriction?: BackendFtwRestriction | null }>(
      `/mcu/cycles/${cycleId}/ftw-assessment`,
      {
        ftwStatus,
        summary,
        restriction: ftwStatus === "FIT_WITH_RESTRICTION" ? restriction : undefined,
      }
    );
  },

  async acknowledgeRestriction(
    restrictionId: string,
    acknowledgementType: AcknowledgementType,
    note?: string
  ): Promise<BackendRestrictionAcknowledgement> {
    return apiClient.post<BackendRestrictionAcknowledgement>(
      `/mcu/restrictions/${restrictionId}/acknowledge`,
      { acknowledgementType, note }
    );
  },

  async closeRestriction(restrictionId: string): Promise<unknown> {
    return apiClient.post(`/mcu/restrictions/${restrictionId}/close`);
  },
};
