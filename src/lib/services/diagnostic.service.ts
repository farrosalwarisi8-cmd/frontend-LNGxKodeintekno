import { apiClient } from "@/lib/api-client";
import {
  BACKEND_UNAVAILABLE,
  rethrowWithAvailability,
} from "@/lib/services/backend-availability";

export interface BackendLabOrderItem {
  id: string;
  lab_test_type_id: string;
  status: string;
  test_type?: {
    id: string;
    code: string;
    name: string;
    specimen_type?: string;
    unit?: string;
    reference_range?: unknown;
  } | null;
}

export interface BackendLabOrder {
  id: string;
  encounter_id?: string | null;
  mcu_cycle_id?: string | null;
  ordered_by?: string | null;
  status: string;
  ordered_at: string;
  order_items?: BackendLabOrderItem[];
}

export interface BackendLabResultValue {
  id: string;
  parameter_name: string;
  numeric_value?: number | null;
  text_value?: string | null;
  unit?: string | null;
  abnormal_flag?: boolean;
}

export interface BackendLabResult {
  id: string;
  lab_order_item_id: string;
  status: string;
  verified_by?: string | null;
  verified_at?: string | null;
  values?: BackendLabResultValue[];
}

export interface BackendRadiologyOrder {
  id: string;
  encounter_id?: string | null;
  modality: string;
  body_part: string;
  ordered_by?: string | null;
  status: string;
  ordered_at: string;
}

export interface BackendRadiologyResult {
  id: string;
  radiology_order_id: string;
  findings?: string | null;
  impression?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  files?: Array<{ id: string; object_key: string; sha256_hash?: string }>;
}

/**
 * Modul 10 — Layanan Penunjang Diagnostik.
 *
 * Endpoint baca (`GET /diagnostic/lab-orders`, `/diagnostic/lab-results`,
 * `/diagnostic/radiology-orders`, dan detailnya) BELUM terdaftar pada backend
 * yang berjalan saat ini; yang tersedia hanya lima endpoint tulis di bawah.
 * Pemanggilan baca tetap dipertahankan agar otomatis berfungsi ketika backend
 * menambahkannya, tetapi route-404 diterjemahkan menjadi
 * `BackendFeatureUnavailableError` supaya UI dapat menjelaskan kapabilitas
 * yang belum ada alih-alih menampilkan "Cannot GET /api/v1/...".
 */
export const diagnosticService = {
  async listLabOrders(): Promise<BackendLabOrder[]> {
    try {
      return await apiClient.get<BackendLabOrder[]>("/diagnostic/lab-orders");
    } catch (e) {
      rethrowWithAvailability(e, BACKEND_UNAVAILABLE.labOrderList);
    }
  },

  async getLabOrder(id: string): Promise<BackendLabOrder> {
    try {
      return await apiClient.get<BackendLabOrder>(`/diagnostic/lab-orders/${id}`);
    } catch (e) {
      rethrowWithAvailability(e, BACKEND_UNAVAILABLE.labOrderDetail);
    }
  },

  async listLabOrderResults(): Promise<BackendLabResult[]> {
    try {
      return await apiClient.get<BackendLabResult[]>("/diagnostic/lab-results");
    } catch (e) {
      rethrowWithAvailability(e, BACKEND_UNAVAILABLE.labResultList);
    }
  },

  async createLabOrder(input: {
    encounterId?: string;
    mcuCycleId?: string;
    labTestTypeIds: string[];
  }): Promise<BackendLabOrder> {
    return apiClient.post<BackendLabOrder>("/diagnostic/lab-orders", input);
  },

  async submitLabResult(input: {
    labOrderItemId: string;
    values: Array<{
      parameterName: string;
      numericValue?: number;
      textValue?: string;
      unit?: string;
      abnormalFlag?: boolean;
    }>;
  }): Promise<BackendLabResult> {
    return apiClient.post<BackendLabResult>("/diagnostic/lab-results", input);
  },

  async verifyLabResult(
    resultId: string,
    comment?: string
  ): Promise<BackendLabResult> {
    return apiClient.post<BackendLabResult>(`/diagnostic/lab-results/${resultId}/verify`, {
      comment,
    });
  },

  async listRadiologyOrders(): Promise<BackendRadiologyOrder[]> {
    try {
      return await apiClient.get<BackendRadiologyOrder[]>(
        "/diagnostic/radiology-orders"
      );
    } catch (e) {
      rethrowWithAvailability(e, BACKEND_UNAVAILABLE.radiologyOrderList);
    }
  },

  async getRadiologyOrder(id: string): Promise<BackendRadiologyOrder> {
    try {
      return await apiClient.get<BackendRadiologyOrder>(
        `/diagnostic/radiology-orders/${id}`
      );
    } catch (e) {
      rethrowWithAvailability(e, BACKEND_UNAVAILABLE.radiologyOrderDetail);
    }
  },

  async createRadiologyOrder(input: {
    encounterId: string;
    modality: string;
    bodyPart: string;
  }): Promise<BackendRadiologyOrder> {
    return apiClient.post<BackendRadiologyOrder>(
      "/diagnostic/radiology-orders",
      input
    );
  },

  async submitRadiologyResult(input: {
    radiologyOrderId: string;
    findings: string;
    impression: string;
    files?: Array<{ objectKey: string; sha256Hash: string }>;
  }): Promise<BackendRadiologyResult> {
    return apiClient.post<BackendRadiologyResult>(
      "/diagnostic/radiology-results",
      input
    );
  },
};
