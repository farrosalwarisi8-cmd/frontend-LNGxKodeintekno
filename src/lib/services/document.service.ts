import { apiClient } from "@/lib/api-client";

/**
 * Modul 9 — Dokumen Medis, Tanda Tangan PSrE & Verifikasi Publik.
 * Endpoint backend (Domain 8):
 *   POST /api/v1/documents/render-pdf
 *   POST /api/v1/signatures/request
 *   POST /api/v1/signatures/callback   (webhook provider, bukan UI)
 *   GET  /api/v1/public/verify/:qrToken
 *
 * Fase 6 — tambahan endpoint untuk tracking & retry:
 *   GET  /api/v1/signatures            (daftar signature request)
 *   GET  /api/v1/signatures/:id        (detail + audit trail)
 *   POST /api/v1/signatures/:id/retry  (retry signature yang gagal/expired)
 */

export interface RenderPdfResult {
  documentId: string;
  title: string;
  objectKey: string;
  qrToken: string;
  verificationUrl: string;
}

export type SignatureStatus = "PENDING" | "SIGNED" | "FAILED" | "EXPIRED" | "PROCESSING" | string;

export interface SignatureRequest {
  id: string;
  document_id?: string;
  signature_type?: string;
  status: SignatureStatus;
  provider_code?: string;
  provider_transaction_id?: string | null;
  certificate_serial?: string | null;
  signed_hash?: string | null;
  signed_at?: string | null;
  requested_at?: string;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  retry_count?: number;
  last_error?: string | null;
}

export interface SignatureAuditEntry {
  id: string;
  signature_id?: string;
  event_type?: string;
  event_data?: Record<string, unknown> | null;
  created_at?: string;
}

export interface PublicVerifyResult {
  isValid: boolean;
  status: string;
  message?: string;
  documentType?: string;
  documentTitle?: string;
  issuedAt?: string;
  issuer?: string;
  signatures?: Array<{
    type?: string;
    signedAt?: string;
    certificateSerial?: string;
  }>;
}

export interface BackendDocument {
  id: string;
  document_type?: string;
  title?: string;
  object_key?: string;
  sha256_hash?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
  locked_at?: string | null;
  /**
   * Token QR verifikasi publik (include `qr_token` dari GET /documents).
   * `token_hash` dipakai oleh halaman /verify/[token].
   */
  qr_token?: {
    token_hash?: string | null;
    revoked?: boolean;
    expires_at?: string | null;
  } | null;
  signature_reqs?: Array<{
    id?: string;
    status?: string;
    signature_type?: string;
    provider_code?: string | null;
    completed_at?: string | null;
  }>;
}

export const documentService = {
  async renderPdf(
    documentType: string,
    referenceId: string,
    title: string
  ): Promise<RenderPdfResult> {
    return apiClient.post<RenderPdfResult>("/documents/render-pdf", {
      documentType,
      referenceId,
      title,
    });
  },

  async requestSignature(
    documentId: string,
    signatureType: string,
    providerCode?: string
  ): Promise<SignatureRequest> {
    return apiClient.post<SignatureRequest>("/signatures/request", {
      documentId,
      signatureType,
      providerCode,
    });
  },

  /**
   * Fase 6 — Daftar semua signature request.
   * Endpoint: GET /signatures (tersedia di backend untuk admin/dokter).
   */
  async getSignatures(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ data: SignatureRequest[]; meta?: { total: number; page: number; limit: number; totalPages: number } }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiClient.get(`/signatures${query ? `?${query}` : ""}`);
  },

  /**
   * Fase 6 — Detail signature + audit trail.
   * Endpoint: GET /signatures/:id
   */
  async getSignature(id: string): Promise<SignatureRequest> {
    return apiClient.get<SignatureRequest>(`/signatures/${id}`);
  },

  /**
   * Fase 6 — Retry signature yang FAILED atau EXPIRED.
   * Endpoint: POST /signatures/:id/retry
   */
  async retrySignature(id: string): Promise<SignatureRequest> {
    return apiClient.post<SignatureRequest>(`/signatures/${id}/retry`);
  },

  /**
   * Fase 6 — Daftar dokumen (untuk signed document download).
   * Endpoint: GET /documents
   *
   * Query backend (lihat QueryDocumentsDto): `documentType`, `status`,
   * `search`, `page`, `limit` — dipakai antara lain oleh sinkronisasi
   * sertifikat (`documentType=FTW_CERTIFICATE`).
   */
  async getDocuments(params?: {
    page?: number;
    limit?: number;
    documentType?: string;
    status?: string;
    search?: string;
  }): Promise<{
    data: BackendDocument[];
    meta?: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.documentType) qs.set("documentType", params.documentType);
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return apiClient.get(`/documents${query ? `?${query}` : ""}`);
  },

  /**
   * Fase 6 — Download dokumen yang sudah signed.
   * Endpoint: GET /documents/:id/download (signed URL di production)
   */
  async downloadDocument(documentId: string): Promise<{ downloadUrl?: string }> {
    return apiClient.get<{ downloadUrl?: string }>(`/documents/${documentId}/download`);
  },

  async verifyPublic(qrToken: string): Promise<PublicVerifyResult> {
    return apiClient.get<PublicVerifyResult>(`/public/verify/${qrToken}`);
  },
};
