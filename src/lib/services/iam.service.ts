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
  /** "TOTP" | "NONE" — metode MFA terdaftar pada akun (GET /iam/users). */
  mfa_method?: string | null;
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

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  roleCode: string;
  siteCode?: string;
}

export interface UpdateUserInput {
  active?: boolean;
  roleCode?: string;
  siteCode?: string;
}

/**
 * Dilempar saat frontend memanggil operasi IAM user yang BELUM tersedia di
 * backend (mis. create/update user). Dipisahkan dari ApiError supaya UI dapat
 * menampilkan pesan kebijakan yang jelas, bukan 404 "Cannot POST" yang ambigu.
 */
export class IamOperationUnsupportedError extends Error {
  constructor(operation: string, detail: string) {
    super(
      `Operasi IAM "${operation}" belum tersedia di backend saat ini: ${detail}`
    );
    this.name = "IamOperationUnsupportedError";
  }
}

export const iamService = {
  /**
   * CATATAN INTEGRASI (Modul 7 — IAM).
   *
   * Backend `iam/users` hanya menyediakan operasi BACA (`GET /iam/users`,
   * `GET /iam/users/:id`) dan `POST /iam/users/:id/unlock`. Tidak ada
   * `POST /iam/users` maupun `PATCH /iam/users/:id` (lihat API_ENDPOINTS.md
   * §1.4–1.5.1 dan `users.controller.ts`). Karena itu pembuatan/penonaktifan
   * akun ditolak lebih awal dengan pesan eksplisit — bukan request ke route
   * yang tidak ada dan bukan pula fake success.
   */
  async createUser(_input: CreateUserInput): Promise<BackendUserRow> {
    throw new IamOperationUnsupportedError(
      "createUser",
      "backend belum mengekspos POST /iam/users (hanya GET /iam/users)."
    );
  },

  async updateUser(_id: string, _input: UpdateUserInput): Promise<BackendUserRow> {
    throw new IamOperationUnsupportedError(
      "updateUser",
      "backend belum mengekspos PATCH /iam/users/:id (hanya GET /iam/users dan POST /iam/users/:id/unlock)."
    );
  },

  /** POST /iam/users/:id/unlock — membuka akun yang terkunci (route backend nyata). */
  async unlockUser(id: string): Promise<{ success: boolean; username?: string; message?: string }> {
    return apiClient.post<{ success: boolean; username?: string; message?: string }>(
      `/iam/users/${id}/unlock`,
      {}
    );
  },

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
