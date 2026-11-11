import { apiClient } from "@/lib/api-client";

/**
 * Modul 9 — Dokumen Medis, Tanda Tangan PSrE & Verifikasi Publik.
 * Endpoint backend (Domain 8):
 *   POST /api/v1/documents/render-pdf
 *   GET  /api/v1/documents
 *   POST /api/v1/signatures/request
 *   POST /api/v1/signatures/callback   (webhook provider, bukan UI)
 *   GET  /api/v1/public/verify/:qrToken
 *
 * Backend TIDAK menyediakan `GET /signatures`, `GET /signatures/:id`,
 * maupun `POST /signatures/:id/retry`. Status tanda tangan dibaca dari
 * `signature_reqs` yang di-include pada `GET /documents`
 * (lihat `BackendDocument.signature_reqs`).
 */

export interface RenderPdfResult {
  documentId: string;
  title: string;
  status?: string;
  /** Lokasi berkas di object storage (tersedia dari `GET /documents`). */
  objectKey?: string;
  /** Hash SHA-256 berkas PDF versi 1 (backend fase 6). */
  sha256Hash?: string;
  /**
   * URL verifikasi publik dari backend — satu-satunya tempat token QR mentah
   * dikembalikan. `GET /documents` hanya memuat `token_hash`, sehingga token
   * mentah tidak bisa direkonstruksi dari daftar dokumen.
   */
  verificationUrl?: string;
}

/** Ambil token QR mentah dari URL verifikasi backend (`.../public/verify/<token>`). */
export function verifyTokenFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const token = url.split("?")[0].split("/").filter(Boolean).pop();
  return token || undefined;
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

/**
 * Respons `GET /public/verify/:qrToken` (zero medical disclosure).
 * Tidak ada identitas pasien, diagnosis, maupun judul dokumen.
 * Status: `VERIFIED`, `NOT_SIGNED`, `INVALID`, `INVALID_OR_EXPIRED`.
 */
export interface PublicVerifyResult {
  isValid: boolean;
  status: string;
  documentType?: string;
  documentNumber?: string;
  issuedAt?: string;
  signedAt?: string | null;
  certificateSerial?: string | null;
}

export interface BackendSignatureReq {
  id?: string;
  status?: string;
  signature_type?: string;
  provider_code?: string | null;
  completed_at?: string | null;
  /** Serial sertifikat dari evidence PSrE (di-include backend). */
  certificate_serial?: string | null;
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
  signature_reqs?: BackendSignatureReq[];
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
   * Daftar signature request — diturunkan dari `signature_reqs` pada
   * `GET /documents` (backend tidak mengekspos `GET /signatures`).
   * Filter status dikerjakan di klien.
   */
  async getSignatures(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ data: SignatureRequest[]; meta?: { total: number; page: number; limit: number; totalPages: number } }> {
    const docsRes = await documentService.getDocuments({
      page: params?.page,
      limit: params?.limit,
    });
    let signatures = docsRes.data.flatMap((doc) =>
      (doc.signature_reqs ?? []).map((sig) => ({
        id: sig.id ?? "",
        document_id: doc.id,
        signature_type: sig.signature_type,
        status: (sig.status ?? "PENDING") as SignatureStatus,
        provider_code: sig.provider_code ?? undefined,
        certificate_serial: sig.certificate_serial ?? null,
        signed_hash: undefined,
        signed_at: sig.completed_at ?? null,
        requested_at: undefined,
        expires_at: undefined,
        created_at: undefined,
        updated_at: undefined,
        retry_count: undefined,
        last_error: undefined,
      }))
    );
    if (params?.status) {
      signatures = signatures.filter((s) => s.status === params.status);
    }
    return { data: signatures, meta: docsRes.meta };
  },

  /**
   * Detail satu signature — dicari dari `signature_reqs` pada daftar
   * dokumen (tidak ada `GET /signatures/:id` di backend).
   */
  async getSignature(id: string): Promise<SignatureRequest> {
    const docsRes = await documentService.getDocuments({ page: 1, limit: 100 });
    for (const doc of docsRes.data) {
      const sig = (doc.signature_reqs ?? []).find((s) => s.id === id);
      if (sig) {
        return {
          id: sig.id ?? "",
          document_id: doc.id,
          signature_type: sig.signature_type,
          status: (sig.status ?? "PENDING") as SignatureStatus,
          provider_code: sig.provider_code ?? undefined,
          certificate_serial: sig.certificate_serial ?? null,
          signed_at: sig.completed_at ?? null,
        };
      }
    }
    throw new Error(`Signature request ${id} tidak ditemukan.`);
  },

  /**
   * Retry signature — backend tidak menyediakan endpoint retry; request
   * signature baru diterbitkan untuk dokumen yang sama.
   */
  async retrySignature(id: string): Promise<SignatureRequest> {
    const current = await documentService.getSignature(id);
    if (!current.document_id) {
      throw new Error("Retry tidak dimungkinkan: dokumen asal tidak diketahui.");
    }
    return documentService.requestSignature(
      current.document_id,
      current.signature_type ?? "CERTIFIED_PSRE",
      current.provider_code ?? undefined
    );
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
    patientId?: string;
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
    if (params?.patientId) qs.set("patientId", params.patientId);
    if (params?.documentType) qs.set("documentType", params.documentType);
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const query = qs.toString();
    return apiClient.get(`/documents${query ? `?${query}` : ""}`);
  },

  /**
   * Unduhan dokumen — `GET /documents/:id/download` mengembalikan presigned
   * URL (berlaku 60 menit) setelah backend memeriksa role & data scope.
   */
  async downloadDocument(
    documentId: string
  ): Promise<{ url: string; expiresIn: number }> {
    return apiClient.get<{ url: string; expiresIn: number }>(
      `/documents/${documentId}/download`
    );
  },

  async verifyPublic(qrToken: string): Promise<PublicVerifyResult> {
    return apiClient.get<PublicVerifyResult>(`/public/verify/${qrToken}`);
  },
};
