import { apiClient } from "@/lib/api-client";

/**
 * Modul 11 — Edge Offline Resilience (sinkronisasi offline).
 * Endpoint backend (Domain 11):
 *   POST /api/v1/sync/register-device   { deviceFingerprintHash, siteCode }
 *   POST /api/v1/sync/push              { deviceId, items[] }
 *   GET  /api/v1/sync/pull?since=&siteCode=
 *   GET  /api/v1/sync/conflicts?deviceId=
 *   POST /api/v1/sync/conflicts/:id/resolve
 *        { resolutionAction: ACCEPT_SERVER | ACCEPT_DEVICE | MERGE, notes? }
 *
 * Backend memproses push per item dan mengembalikan status per item
 * (CONFLICT / APPLIED / FAILED), sehingga UI bisa mereplay antrean lokal
 * dan menandai mana yang perlu penyelesaian manual.
 */

export interface SyncPushItem {
  /** ID record di perangkat (uuid v4 yang dibuat lokal saat offline). */
  localRecordId: string;
  /** Jenis entitas, mis. `VITAL_SIGN`, `ENCOUNTER`, `MCU_CYCLE`. */
  entityType: string;
  /** Isi record yang akan diterapkan backend. */
  payload: Record<string, unknown>;
}

export interface SyncPushResultItem {
  localRecordId?: string;
  status?: string;
  message?: string;
  reason?: string;
}

export interface SyncPushResponse {
  deviceId?: string;
  totalReceived?: number;
  results?: SyncPushResultItem[];
}

export interface SyncDelta {
  icd10?: unknown[];
  medications?: unknown[];
  clinicalRules?: unknown[];
}

export interface SyncPullResponse {
  syncedAt?: string;
  delta?: SyncDelta;
}

export interface SyncConflict {
  id: string;
  status?: string;
  local_payload?: unknown;
  server_payload?: unknown;
  synced_at?: string;
  offline_queue?: {
    id?: string;
    device_id?: string;
    entity_type?: string;
    local_record_id?: string;
    payload?: unknown;
  } | null;
}

export type SyncResolutionAction = "ACCEPT_SERVER" | "ACCEPT_DEVICE" | "MERGE";

export interface SyncConflictResolution {
  event?: unknown;
  action?: SyncResolutionAction;
  notes?: string | null;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

export const syncService = {
  /**
   * Daftarkan perangkat ini ke backend.
   * `deviceFingerprintHash` dibuat lokal (lihat `deviceFingerprintHash`);
   * `siteCode` menentukan site yang datanya akan di-pull.
   */
  async registerDevice(
    deviceFingerprintHash: string,
    siteCode: string
  ): Promise<{ id?: string; device_id?: string; [key: string]: unknown }> {
    return apiClient.post<{ id?: string; device_id?: string }>(
      "/sync/register-device",
      { deviceFingerprintHash, siteCode }
    );
  },

  /** Kirim batch record yang terekam saat offline. */
  async push(deviceId: string, items: SyncPushItem[]): Promise<SyncPushResponse> {
    return apiClient.post<SyncPushResponse>("/sync/push", { deviceId, items });
  },

  /**
   * Tarik delta master data sejak `since` (ISO string).
   * Backend menerima `since` kosong dengan fallback 24 jam terakhir, tetapi
   * pemanggil sebaiknya selalu mengirim timestamp sinkronisasi terakhir.
   */
  async pull(since: string, siteCode?: string): Promise<SyncPullResponse> {
    const qs = new URLSearchParams({ since });
    if (siteCode) qs.set("siteCode", siteCode);
    return apiClient.get<SyncPullResponse>(`/sync/pull?${qs.toString()}`);
  },

  /** Daftar konflik sinkronisasi yang butuh keputusan manual. */
  async listConflicts(deviceId?: string): Promise<SyncConflict[]> {
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : "";
    return apiClient.get<SyncConflict[]>(`/sync/conflicts${qs}`);
  },

  /** Selesaikan satu konflik (dokter OH / admin klinik). */
  async resolveConflict(
    conflictId: string,
    resolutionAction: SyncResolutionAction,
    notes?: string
  ): Promise<SyncConflictResolution> {
    return apiClient.post<SyncConflictResolution>(
      `/sync/conflicts/${encodeURIComponent(conflictId)}/resolve`,
      { resolutionAction, notes }
    );
  },
};
