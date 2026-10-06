import { apiClient } from "@/lib/api-client";

/**
 * Modul 7 — IAM (User Management & Audit Log).
 * Endpoint backend (Domain 1):
 *   GET  /api/v1/iam/users?page=&limit=
 *   GET  /api/v1/iam/users/:id
 *   GET  /api/v1/iam/audit-logs?page=&limit=
 *   POST /api/v1/iam/audit-logs/verify-chain
 */

export interface BackendUserRole {
  id: string;
  org_unit_id?: string;
  site_id?: string;
  role?: { id?: string; code?: string; name?: string; data_scope?: string };
  site?: { id?: string; code?: string; name?: string };
}

export interface BackendUserRow {
  id: string;
  username: string;
  email?: string;
  active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  user_roles?: BackendUserRole[];
}

export interface BackendAuditLogRow {
  id: string;
  actor_user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  prev_hash?: string;
  event_hash?: string;
  payload_snapshot?: unknown;
  created_at: string;
  actor?: { id?: string; username?: string; email?: string };
}

export interface AuditChainResult {
  isValid: boolean;
  brokenAtIndex?: number;
  brokenEntryId?: string;
}

export const iamService = {
  async listUsers(page = 1, limit = 20) {
    const res = await apiClient.getPaged<BackendUserRow[]>(
      `/iam/users?page=${page}&limit=${limit}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async getUser(id: string): Promise<BackendUserRow> {
    return apiClient.get<BackendUserRow>(`/iam/users/${id}`);
  },

  async listAuditLogs(page = 1, limit = 20) {
    const res = await apiClient.getPaged<BackendAuditLogRow[]>(
      `/iam/audit-logs?page=${page}&limit=${limit}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async verifyChain(): Promise<AuditChainResult> {
    return apiClient.post<AuditChainResult>("/iam/audit-logs/verify-chain");
  },
};
