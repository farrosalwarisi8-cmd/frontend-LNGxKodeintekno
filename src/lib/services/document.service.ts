import { apiClient } from "@/lib/api-client";

export interface RenderPdfResult {
  documentId: string;
  pdfUrl: string;
  title: string;
}

export interface SignatureRequest {
  id: string;
  documentId: string;
  status: "PENDING" | "SIGNED" | "FAILED";
  signatureUrl?: string;
}

export const documentService = {
  async renderPdf(documentType: string, referenceId: string, title: string): Promise<RenderPdfResult> {
    return apiClient.post<RenderPdfResult>("/documents/render-pdf", { documentType, referenceId, title });
  },

  async requestSignature(documentId: string, signatureType: string, providerCode?: string): Promise<SignatureRequest> {
    return apiClient.post<SignatureRequest>("/signatures/request", { documentId, signatureType, providerCode });
  },

  async verifyPublic(qrToken: string): Promise<{ valid: boolean; documentType: string; issuedAt: string }> {
    return apiClient.get(`/public/verify/${qrToken}`);
  },
};
