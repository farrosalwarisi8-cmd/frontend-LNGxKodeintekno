import { apiClient } from "@/lib/api-client";

/**
 * Konfigurasi sistem & observability — endpoint backend:
 *   GET  /api/v1/admin/settings?page=&limit=   (SYSTEM_ADMIN, COMPLIANCE_AUDITOR, DOCTOR_OH)
 *   GET  /api/v1/admin/settings/:key
 *   POST /api/v1/admin/settings               (SYSTEM_ADMIN)
 *   PUT  /api/v1/admin/settings/:key          (SYSTEM_ADMIN)
 *   DELETE /api/v1/admin/settings/:key        (SYSTEM_ADMIN)
 *   POST /api/v1/admin/settings/reset-defaults (SYSTEM_ADMIN)
 *   GET  /api/v1/metrics/json                 (SYSTEM_ADMIN, HSE_MANAGER)
 *   GET  /api/v1/metrics/queue                (SYSTEM_ADMIN, HSE_MANAGER)
 *   GET  /api/v1/metrics/alerts               (SYSTEM_ADMIN, HSE_MANAGER)
 *
 * Catatan: controller terdaftar dengan DUA prefix (`admin/settings` dan
 * `system-settings`); frontend memakai `admin/settings`.
 * Body setting memakai snake_case sesuai DTO backend (`setting_key`,
 * `setting_value`), berbeda dari mayoritas DTO lain yang camelCase.
 */

export interface BackendSystemSetting {
  id?: string;
  setting_key: string;
  setting_value: unknown;
  version?: string;
  effective_at?: string;
  updated_at?: string;
}

export interface CreateSystemSettingInput {
  setting_key: string;
  setting_value: unknown;
  version?: string;
}

export interface MetricPoint {
  name?: string;
  value?: number;
  tags?: Record<string, string>;
  timestamp?: string;
}

export interface WorkerStatus {
  [key: string]: unknown;
}

export interface OperationalAlert {
  [key: string]: unknown;
}

export const systemService = {
  async listSettings(params?: {
    page?: number;
    limit?: number;
  }): Promise<{
    data: BackendSystemSetting[];
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const res = await apiClient.getPaged<BackendSystemSetting[]>(
      `/admin/settings${query ? `?${query}` : ""}`
    );
    return { data: res.data ?? [], meta: res.meta };
  },

  async getSetting(key: string): Promise<BackendSystemSetting> {
    return apiClient.get<BackendSystemSetting>(
      `/admin/settings/${encodeURIComponent(key)}`
    );
  },

  async createSetting(input: CreateSystemSettingInput): Promise<BackendSystemSetting> {
    return apiClient.post<BackendSystemSetting>("/admin/settings", input);
  },

  async updateSetting(
    key: string,
    input: { setting_value: unknown; version?: string }
  ): Promise<BackendSystemSetting> {
    return apiClient.put<BackendSystemSetting>(
      `/admin/settings/${encodeURIComponent(key)}`,
      input
    );
  },

  async deleteSetting(key: string): Promise<unknown> {
    return apiClient.delete(`/admin/settings/${encodeURIComponent(key)}`);
  },

  async resetDefaults(): Promise<unknown> {
    return apiClient.post("/admin/settings/reset-defaults", {});
  },

  /** Metrik internal aplikasi (SYSTEM_ADMIN / HSE_MANAGER). */
  async getMetrics(): Promise<MetricPoint[]> {
    return apiClient.get<MetricPoint[]>("/metrics/json");
  },

  /** Status worker antrean (SYSTEM_ADMIN / HSE_MANAGER). */
  async getQueueStatus(): Promise<WorkerStatus> {
    return apiClient.get<WorkerStatus>("/metrics/queue");
  },

  /** Alert operasional yang sudah dievaluasi (SYSTEM_ADMIN / HSE_MANAGER). */
  async getAlerts(): Promise<OperationalAlert[]> {
    return apiClient.get<OperationalAlert[]>("/metrics/alerts");
  },
};
