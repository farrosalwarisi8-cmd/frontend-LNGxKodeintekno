import { apiClient } from "@/lib/api-client";

/**
 * Modul 4 — Visitor Waiver (pesan/profil pengunjung offshore).
 * Endpoint backend (Domain 4):
 *   POST /api/v1/mcu/visitor-waivers
 *   GET  /api/v1/mcu/visitor-waivers?status=&search=&page=&limit=
 *   GET  /api/v1/mcu/visitor-waivers/:id
 *   POST /api/v1/mcu/visitor-waivers/:id/decision   { decision: APPROVE | REJECT, note? }
 *   POST /api/v1/public/visitor-waivers/verify      { token, action: VIEW | APPROVED | REJECTED }
 */

export interface BackendVisitorWaiver {
  id: string;
  visitor_name: string;
  email: string;
  company?: string | null;
  purpose: string;
  deviation?: string | null;
  medication?: string | null;
  exposure_risk?: string | null;
  health_declaration?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  status: string;
  decision?: string | null;
  decision_note?: string | null;
  decided_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  patient_id?: string | null;
  /** Status verifikasi email (token) bila backend menyertakannya. */
  consent?: {
    id?: string;
    email?: string;
    decision?: string | null;
    used_at?: string | null;
    token_expires_at?: string | null;
  } | null;
}

export interface CreateVisitorWaiverInput {
  visitorName: string;
  email: string;
  purpose: string;
  company?: string;
  deviation?: string;
  medication?: string;
  exposureRisk?: string;
  healthDeclaration?: string;
  /** Masa berlaku dalam hari (default backend: 14). */
  validDays?: number;
  patientId?: string;
}

export const visitorWaiverService = {
  async list(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: BackendVisitorWaiver[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await apiClient.getPaged<BackendVisitorWaiver[]>(
      `/mcu/visitor-waivers${query ? `?${query}` : ""}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async get(id: string): Promise<BackendVisitorWaiver> {
    return apiClient.get<BackendVisitorWaiver>(`/mcu/visitor-waivers/${id}`);
  },

  async create(input: CreateVisitorWaiverInput): Promise<BackendVisitorWaiver> {
    return apiClient.post<BackendVisitorWaiver>("/mcu/visitor-waivers", input);
  },

  /**
   * Keputusan dokter/HSE — enum backend `APPROVE | REJECT`
   * (BERBEDA dari `/waivers/:id/decision` yang memakai APPROVED | REJECTED).
   */
  async decide(
    id: string,
    decision: "APPROVE" | "REJECT",
    note?: string
  ): Promise<BackendVisitorWaiver> {
    return apiClient.post<BackendVisitorWaiver>(
      `/mcu/visitor-waivers/${id}/decision`,
      { decision, note }
    );
  },

  async verifyPublic(
    token: string,
    action: "VIEW" | "APPROVED" | "REJECTED"
  ): Promise<{ valid: boolean; status?: string; message?: string }> {
    return apiClient.post<{ valid: boolean; status?: string; message?: string }>(
      "/public/visitor-waivers/verify",
      { token, action }
    );
  },
};
