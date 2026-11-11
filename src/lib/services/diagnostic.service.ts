import { apiClient } from "@/lib/api-client";

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
  /**
   * Hasil lab per item (di-include backend pada GET list & detail order).
   * Backend tidak menyediakan `GET /diagnostic/lab-results` — hasil dibaca
   * dari sini, bukan dari endpoint tersendiri.
   */
  lab_result?: BackendLabOrderItemResult | null;
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

/** Hasil lab yang ditempel pada item order (dari `GET /diagnostic/lab-orders/:id`). */
export interface BackendLabOrderItemResult extends BackendLabResult {
  lab_result_id?: string;
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

export const diagnosticService = {
  async listLabOrders(params?: {
    encounterId?: string;
    mcuCycleId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<BackendLabOrder[]> {
    const qs = new URLSearchParams();
    if (params?.encounterId) qs.set("encounterId", params.encounterId);
    if (params?.mcuCycleId) qs.set("mcuCycleId", params.mcuCycleId);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return apiClient.get<BackendLabOrder[]>(
      `/diagnostic/lab-orders${query ? `?${query}` : ""}`
    );
  },

  async getLabOrder(id: string): Promise<BackendLabOrder> {
    return apiClient.get<BackendLabOrder>(`/diagnostic/lab-orders/${id}`);
  },

  /**
   * Daftar hasil lab — backend tidak menyediakan `GET /diagnostic/lab-results`
   * (hanya `POST` submit & verify). Hasil dikumpulkan dari `lab_result` yang
   * di-include tiap item pada daftar order, sehingga satu round-trip cukup.
   */
  async listLabOrderResults(): Promise<BackendLabResult[]> {
    const orders = await diagnosticService.listLabOrders();
    const results: BackendLabResult[] = [];
    for (const order of orders) {
      for (const item of order.order_items ?? []) {
        const r = item.lab_result;
        if (r) {
          results.push({
            id: r.id,
            lab_order_item_id: item.id,
            status: r.status,
            verified_by: r.verified_by,
            verified_at: r.verified_at,
            values: r.values,
          });
        }
      }
    }
    return results;
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

  async listRadiologyOrders(params?: {
    encounterId?: string;
    status?: string;
    modality?: string;
    page?: number;
    limit?: number;
  }): Promise<BackendRadiologyOrder[]> {
    const qs = new URLSearchParams();
    if (params?.encounterId) qs.set("encounterId", params.encounterId);
    if (params?.status) qs.set("status", params.status);
    if (params?.modality) qs.set("modality", params.modality);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return apiClient.get<BackendRadiologyOrder[]>(
      `/diagnostic/radiology-orders${query ? `?${query}` : ""}`
    );
  },

  async getRadiologyOrder(id: string): Promise<BackendRadiologyOrder> {
    return apiClient.get<BackendRadiologyOrder>(`/diagnostic/radiology-orders/${id}`);
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
