import { apiClient } from "@/lib/api-client";

/**
 * Modul 8 — Reporting, Analytics & BI.
 * Endpoint backend (Domain 12):
 *   GET  /api/v1/reports/definitions
 *   POST /api/v1/reports/runs
 *   GET  /api/v1/reports/exports/:id/download
 *   GET  /api/v1/analytics/top-diseases?startDate=&endDate=&siteId=
 */

export interface ReportDefinition {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  active?: boolean;
  [key: string]: unknown;
}

export interface ReportRunResult {
  runId: string;
  status: string;
  exportId: string;
  format: string;
  message: string;
}

export interface ReportDownload {
  exportId: string;
  format: string;
  downloadUrl: string;
  watermark?: { printedBy?: string; printedAt?: string; auditRef?: string };
  /** Masa berlaku URL unduh (detik) — selalu 3600 dari backend. */
  expiresInSeconds?: number;
}

export interface TopDiseaseItem {
  rank: number;
  icd10Code: string;
  diseaseName: string;
  totalCases: number;
  percentageShare: number;
}

export interface TopDiseasesResult {
  timeframe?: { start?: string; end?: string };
  totalSampledCases?: number;
  top10Morbidity?: TopDiseaseItem[];
  anonymityDeclaration?: string;
}

export const reportingService = {
  /**
   * Backend mengembalikan array mentah (tanpa envelope paginasi),
   * sehingga dibaca langsung, bukan lewat `getPaged`.
   */
  async getDefinitions(): Promise<ReportDefinition[]> {
    return apiClient.get<ReportDefinition[]>("/reports/definitions");
  },

  async runReport(
    reportDefinitionId: string,
    format?: string,
    parameters?: Record<string, unknown>
  ): Promise<ReportRunResult> {
    return apiClient.post<ReportRunResult>("/reports/runs", {
      reportDefinitionId,
      ...(format ? { format } : {}),
      ...(parameters && Object.keys(parameters).length > 0 ? { parameters } : {}),
    });
  },

  async downloadExport(exportId: string): Promise<ReportDownload> {
    return apiClient.get<ReportDownload>(`/reports/exports/${exportId}/download`);
  },

  async topDiseases(params: {
    startDate?: string;
    endDate?: string;
    siteId?: string;
  } = {}): Promise<TopDiseasesResult> {
    const query = new URLSearchParams();
    if (params.startDate) query.set("startDate", params.startDate);
    if (params.endDate) query.set("endDate", params.endDate);
    if (params.siteId) query.set("siteId", params.siteId);
    const qs = query.toString();
    return apiClient.get<TopDiseasesResult>(`/analytics/top-diseases${qs ? `?${qs}` : ""}`);
  },
};
