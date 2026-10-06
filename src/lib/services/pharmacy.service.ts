import { apiClient } from "@/lib/api-client";

/**
 * Modul 5 — Farmasi & FEFO Inventory Engine.
 * Endpoint backend (Domain 6):
 *   GET  /api/v1/pharmacy/inventory?siteId=
 *   GET  /api/v1/pharmacy/prescriptions/pending?siteId=
 *   POST /api/v1/pharmacy/dispensing/recommend-batches
 *   POST /api/v1/pharmacy/dispensing
 *   POST /api/v1/pharmacy/returns
 */

export interface BackendInventoryItem {
  id: string;
  medicationCode: string;
  genericName: string;
  strength?: string;
  dosageForm?: string;
  isControlled?: boolean;
  siteName: string;
  currentStock: number;
  minimumStock: number;
  isLowStock: boolean;
  activeBatchesCount: number;
  nearestExpiryDate?: string | null;
}

export interface BackendPrescriptionItem {
  id: string;
  medication_id?: string;
  quantity?: number;
  dosage?: string | null;
  medication?: {
    id?: string;
    code?: string;
    generic_name?: string;
    strength?: string;
  };
}

export interface BackendPrescription {
  id: string;
  encounter_id?: string | null;
  status?: string;
  prescribed_at?: string;
  encounter?: {
    id?: string;
    patient_id?: string;
    patient?: { id?: string; full_name?: string; medical_record_no?: string };
  };
  items?: BackendPrescriptionItem[];
}

export interface FefoRecommendation {
  medicationId: string;
  siteId: string;
  requiredQuantity: number;
  isFullyAllocatable: boolean;
  shortfall: number;
  recommendedBatches: Array<{
    batchId: string;
    batchNo: string;
    expiryDate: string;
    available: number;
    allocated: number;
  }>;
}

export const pharmacyService = {
  async getInventory(siteId?: string): Promise<BackendInventoryItem[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<BackendInventoryItem[]>(`/pharmacy/inventory${qs}`);
  },

  async getPendingPrescriptions(siteId?: string): Promise<BackendPrescription[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<BackendPrescription[]>(`/pharmacy/prescriptions/pending${qs}`);
  },

  async recommendBatches(
    medicationId: string,
    siteId: string,
    requiredQuantity: number
  ): Promise<FefoRecommendation> {
    return apiClient.post<FefoRecommendation>("/pharmacy/dispensing/recommend-batches", {
      medicationId,
      siteId,
      requiredQuantity,
    });
  },

  async dispense(
    prescriptionId: string,
    allocations: Array<{ stockBatchId: string; quantity: number }>
  ): Promise<{ id?: string; prescription_id?: string }> {
    return apiClient.post("/pharmacy/dispensing", { prescriptionId, allocations });
  },

  async returnMedication(
    dispensingId: string,
    stockBatchId: string,
    quantity: number,
    reason: string
  ): Promise<unknown> {
    return apiClient.post("/pharmacy/returns", {
      dispensingId,
      stockBatchId,
      quantity,
      reason,
    });
  },
};
