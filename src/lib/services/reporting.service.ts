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
}

export interface TopDiseaseItem {
  rank: number;
  icd10?: string;
  code?: string;
  name?: string;
  disease?: string;
  caseCount?: number;
  count?: number;
  prevalencePercent?: number;
}

export interface TopDiseasesResult {
  site?: string;
  timeframe?: { start?: string; end?: string };
  period?: string;
  totalSampledCases?: number;
  top10Morbidity?: TopDiseaseItem[];
  topDiseases?: TopDiseaseItem[];
  anonymityDeclaration?: string;
}

export const reportingService = {
  async getDefinitions(): Promise<ReportDefinition[]> {
    const res = await apiClient.getPaged<ReportDefinition[]>("/reports/definitions");
    return res.data ?? [];
  },

  async runReport(
    reportDefinitionId: string,
    format: string,
    parameters: Record<string, unknown> = {}
  ): Promise<ReportRunResult> {
    return apiClient.post<ReportRunResult>("/reports/runs", {
      reportDefinitionId,
      format,
      parameters,
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
