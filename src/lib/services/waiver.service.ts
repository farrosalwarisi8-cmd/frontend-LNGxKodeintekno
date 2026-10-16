import { apiClient } from "@/lib/api-client";

/**
 * Modul 4 — Visitor Waiver (HSE).
 * Endpoint backend:
 *   GET   /api/v1/waivers?page=&limit=&search=
 *   GET   /api/v1/waivers/:id
 *   POST  /api/v1/waivers
 *   PATCH /api/v1/waivers/:id
 *   POST  /api/v1/waivers/:id/decision   { status: APPROVED | REJECTED }
 *   POST  /api/v1/waivers/:id/send       { email? }
 *   POST  /api/v1/waivers/:id/revoke
 *   POST  /api/v1/public/waivers/verify  { token }
 *   POST  /api/v1/public/waivers/:token/approve
 *   POST  /api/v1/public/waivers/:token/reject
 */

export type WaiverDecision = "PENDING" | "APPROVED" | "REJECTED";
export type WaiverLifecycle = WaiverDecision | "EXPIRED";

export interface BackendWaiverConsent {
  id: string;
  email: string;
  decision?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  used_at?: string | null;
  revoked_at?: string | null;
  token_expires_at?: string | null;
}

export interface BackendWaiver {
  id: string;
  patient_id?: string | null;
  site_id?: string | null;
  visitor_name: string;
  company?: string | null;
  host_name?: string | null;
  host_email?: string | null;
  purpose: string;
  visit_at?: string | null;
  valid_until: string;
  deviation?: string | null;
  medication?: string | null;
  exposure_risk?: string | null;
  health_declaration?: string | null;
  status: string;
  decision?: WaiverDecision;
  lifecycle?: WaiverLifecycle;
  created_at?: string;
  site?: { id?: string; code?: string; name?: string } | null;
  waiver_consent?: BackendWaiverConsent | null;
}

export interface CreateWaiverInput {
  visitorName: string;
  company?: string;
  hostName?: string;
  hostEmail?: string;
  purpose: string;
  validUntil: string;
  visitAt?: string;
  siteCode?: string;
  deviation?: string;
  medication?: string;
  exposureRisk?: string;
  healthDeclaration?: string;
}

export interface SendWaiverResult {
  status: string;
  email: string;
  expiresAt: string;
  /** Hanya tersedia pada non-production untuk pengujian end-to-end. */
  devToken?: string;
}

export interface PublicVerifyResult {
  valid: boolean;
  visitorName: string;
  company?: string | null;
  purpose: string;
  site?: string | null;
  validUntil: string;
  decision?: string | null;
}

/**
 * Fase 4 — penyaringan scope site untuk daftar waiver.
 *
 * Backend meng-scope `GET /waivers` per token; untuk user GLOBAL yang memilih
 * satu site di UI, baris di luar scope itu dibuang di client. `null` = semua
 * site (cakupan bawaan token), jadi daftar tidak disaring.
 */
export function filterWaiversBySite(
  rows: BackendWaiver[],
  activeSiteId: string | null | undefined
): BackendWaiver[] {
  if (!activeSiteId) return rows;
  return rows.filter((w) => (w.site_id ?? w.site?.id ?? null) === activeSiteId);
}

export const waiverService = {
  async list(page = 1, limit = 50, search?: string) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) query.set("search", search);
    const res = await apiClient.getPaged<BackendWaiver[]>(`/waivers?${query.toString()}`);
    return { data: res.data ?? [], meta: res.meta };
  },

  async get(id: string): Promise<BackendWaiver> {
    return apiClient.get<BackendWaiver>(`/waivers/${id}`);
  },

  async create(input: CreateWaiverInput): Promise<BackendWaiver> {
    return apiClient.post<BackendWaiver>("/waivers", input);
  },

  async update(id: string, input: Partial<CreateWaiverInput>): Promise<BackendWaiver> {
    return apiClient.patch<BackendWaiver>(`/waivers/${id}`, input);
  },

  async decide(id: string, status: "APPROVED" | "REJECTED"): Promise<BackendWaiver> {
    return apiClient.post<BackendWaiver>(`/waivers/${id}/decision`, { status });
  },

  async send(id: string, email?: string): Promise<SendWaiverResult> {
    return apiClient.post<SendWaiverResult>(`/waivers/${id}/send`, email ? { email } : {});
  },

  async revoke(id: string): Promise<{ status: string; revokedAt: string }> {
    return apiClient.post<{ status: string; revokedAt: string }>(`/waivers/${id}/revoke`);
  },

  async publicVerify(token: string): Promise<PublicVerifyResult> {
    return apiClient.post<PublicVerifyResult>("/public/waivers/verify", { token });
  },

  async publicApprove(token: string): Promise<{ status: string; decision: string }> {
    return apiClient.post<{ status: string; decision: string }>(
      `/public/waivers/${encodeURIComponent(token)}/approve`
    );
  },

  async publicReject(token: string): Promise<{ status: string; decision: string }> {
    return apiClient.post<{ status: string; decision: string }>(
      `/public/waivers/${encodeURIComponent(token)}/reject`
    );
  },
};
