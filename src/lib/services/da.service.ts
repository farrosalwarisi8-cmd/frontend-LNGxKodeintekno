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
}

export interface BackendDaSample {
  id: string;
  da_test_id?: string;
  sample_no?: string;
  specimen_type?: string;
  status?: string;
}

export type DaTestType =
  | "PRE_EMPLOYMENT"
  | "RANDOM_INSPECTION"
  | "POST_INCIDENT"
  | "FOR_CAUSE";

export const daService = {
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
