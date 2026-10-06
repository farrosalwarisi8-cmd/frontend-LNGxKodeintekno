import { apiClient } from "@/lib/api-client";

/**
 * Modul 9 — Dokumen Medis, Tanda Tangan PSrE & Verifikasi Publik.
 * Endpoint backend (Domain 8):
 *   POST /api/v1/documents/render-pdf
 *   POST /api/v1/signatures/request
 *   POST /api/v1/signatures/callback   (webhook provider, bukan UI)
 *   GET  /api/v1/public/verify/:qrToken
 */

export interface RenderPdfResult {
  documentId: string;
  title: string;
  objectKey: string;
  qrToken: string;
  verificationUrl: string;
}

export interface SignatureRequest {
  id: string;
  document_id?: string;
  signature_type?: string;
  status: "PENDING" | "SIGNED" | "FAILED" | string;
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

  async verifyPublic(qrToken: string): Promise<PublicVerifyResult> {
    return apiClient.get<PublicVerifyResult>(`/public/verify/${qrToken}`);
  },
};
