import { apiClient } from "@/lib/api-client";

/**
 * Modul 10 — Forensic Drug & Alcohol (D&A) Testing.
 * Endpoint backend (Domain 7):
 *   POST /api/v1/da/tests
 *   POST /api/v1/da/samples
 *   POST /api/v1/da/samples/:id/chain-of-custody
 *   POST /api/v1/da/tests/:id/results
 *   POST /api/v1/da/tests/:id/certificate
 *
 * Catatan: backend tidak menyediakan GET untuk daftar tes D&A,
 * sehingga daftar tetap disimpan di state frontend (satu arah).
 */

export interface BackendDaTest {
  id: string;
  patient_id?: string;
  encounter_id?: string | null;
  test_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  collected_at?: string | null;
  ordered_by?: string | null;
  patient?: {
    id: string;
    medical_record_no?: string;
    full_name?: string;
    employee_id?: string;
    birth_date?: string;
    sex?: string;
  };
  samples?: BackendDaSample[];
  results?: BackendDaResult[];
  certificate?: {
    id: string;
    da_test_id?: string;
    document_id?: string;
    signed_by?: string;
    issued_at?: string;
  } | null;
}

export interface BackendDaSample {
  id: string;
  da_test_id?: string;
  sample_no?: string;
  specimen_type?: string;
  status?: string;
  sealed_at?: string | null;
  custody_chain?: BackendCustodyEntry[];
}

export interface BackendCustodyEntry {
  id: string;
  sample_id?: string;
  from_party: string;
  to_party: string;
  action: string;
  signature_hash: string;
  event_at: string;
}

export interface BackendDaResult {
  id: string;
  da_test_id?: string;
  screening_result?: string;
  confirmation_result?: string | null;
  confirmed?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface BackendDaTestsResponse {
  data: BackendDaTest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type DaTestType =
  | "PRE_EMPLOYMENT"
  | "RANDOM_INSPECTION"
  | "POST_INCIDENT"
  | "FOR_CAUSE";

export const daService = {
  async getTests(params?: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
  }): Promise<BackendDaTestsResponse> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    if (params?.patientId) qs.set("patientId", params.patientId);
    const query = qs.toString();
    return apiClient.get<BackendDaTestsResponse>(`/da/tests${query ? `?${query}` : ""}`);
  },

  async createTest(
    patientId: string,
    testType: DaTestType = "RANDOM_INSPECTION",
    encounterId?: string
  ): Promise<BackendDaTest> {
    return apiClient.post<BackendDaTest>("/da/tests", {
      patientId,
      encounterId,
      testType,
    });
  },

  async createSample(
    daTestId: string,
    sampleNo: string,
    specimenType: string
  ): Promise<BackendDaSample> {
    return apiClient.post<BackendDaSample>("/da/samples", {
      daTestId,
      sampleNo,
      specimenType,
    });
  },

  async addCustody(
    sampleId: string,
    fromParty: string,
    toParty: string,
    action: string
  ): Promise<unknown> {
    return apiClient.post(`/da/samples/${sampleId}/chain-of-custody`, {
      fromParty,
      toParty,
      action,
    });
  },

  async submitResults(
    testId: string,
    screeningResult: string,
    confirmationResult?: string,
    confirmed?: boolean
  ): Promise<unknown> {
    return apiClient.post(`/da/tests/${testId}/results`, {
      screeningResult,
      confirmationResult,
      confirmed,
    });
  },

  async issueCertificate(testId: string): Promise<unknown> {
    return apiClient.post(`/da/tests/${testId}/certificate`);
  },
};
