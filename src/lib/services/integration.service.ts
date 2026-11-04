import { apiClient } from "@/lib/api-client";

/**
 * Modul 10 — Interoperabilitas Eksternal & Whitelisted Open API.
 * Endpoint backend (Domain 10):
 *   POST /api/v1/admin/api-clients              { organizationId, clientName, allowedNetwork?, rateLimitPerMinute?, scopes[] }
 *   GET  /api/v1/satusehat/fhir/encounter/:id   (SYSTEM_ADMIN, DOCTOR_OH, DOCTOR_CLINIC)
 *
 * `GET /api/v1/mcu-status/:identifier` TIDAK dikonsumsi frontend: route itu
 * memakai header `X-API-Key` (bukan Bearer JWT) dan hanya untuk sistem luar
 * seperti turnstile/HRIS — lihat API_ENDPOINTS.md §10.2.
 */

export interface CreateApiClientInput {
  organizationId: string;
  clientName: string;
  /** IP CIDR whitelist, mis. `192.168.1.0/24` (opsional). */
  allowedNetwork?: string;
  /** Batas request per menit (default backend: 300). */
  rateLimitPerMinute?: number;
  /** Scope yang diberikan, mis. `mcu_status:read`. */
  scopes: string[];
}

export interface CreateApiClientResult {
  clientId: string;
  clientName: string;
  /** Kunci mentah — HANYA dikembalikan sekali saat pembuatan. */
  apiKey: string;
  message?: string;
}

/** Bundle HL7 FHIR R4 (transaction) untuk SATUSEHAT. */
export interface SatuSehatFhirBundle {
  resourceType?: string;
  id?: string;
  type?: string;
  timestamp?: string;
  meta?: Record<string, unknown>;
  entry?: Array<{
    fullUrl?: string;
    resource?: Record<string, unknown>;
  }>;
}

export const integrationService = {
  /**
   * Daftarkan API client pihak ketiga (Turnstile, SAP HRIS).
   *
   * Backend mengembalikan kunci mentah SATU KALI dan hanya menyimpan hash
   * SHA-256-nya — setelah respons ini tidak ada cara mengambil kunci lagi,
   * sehingga UI wajib menyuruh pengguna menyalinnya sekarang.
   */
  async createApiClient(input: CreateApiClientInput): Promise<CreateApiClientResult> {
    return apiClient.post<CreateApiClientResult>("/admin/api-clients", input);
  },

  /** Ekspor encounter sebagai Bundle HL7 FHIR R4 untuk SATUSEHAT. */
  async getSatusehatFhirEncounter(encounterId: string): Promise<SatuSehatFhirBundle> {
    return apiClient.get<SatuSehatFhirBundle>(
      `/satusehat/fhir/encounter/${encodeURIComponent(encounterId)}`
    );
  },
};
