import { apiClient } from "@/lib/api-client";

export interface StockBatch {
  id: string;
  medicationId: string;
  medicationName: string;
  batchNumber: string;
  quantity: number;
  expiresAt: string;
  siteId: string;
}

export interface Dispensing {
  id: string;
  prescriptionId: string;
  patientName: string;
  items: Array<{
    medicationId: string;
    medicationName: string;
    batchId: string;
    quantity: number;
  }>;
  status: "PENDING" | "DISPENSED" | "RETURNED";
  createdAt: string;
}

export const pharmacyService = {
  async getInventory(siteId?: string): Promise<StockBatch[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<StockBatch[]>(`/pharmacy/inventory${qs}`);
  },

  async getPendingPrescriptions(siteId?: string): Promise<Dispensing[]> {
    const qs = siteId ? `?siteId=${siteId}` : "";
    return apiClient.get<Dispensing[]>(`/pharmacy/prescriptions/pending${qs}`);
  },

  async recommendBatches(medicationId: string, siteId: string, requiredQuantity: number) {
    return apiClient.post("/pharmacy/dispensing/recommend-batches", {
      medicationId,
      siteId,
      requiredQuantity,
    });
  },

  async dispense(
    prescriptionId: string,
    allocations: Array<{ stockBatchId: string; quantity: number }>
  ): Promise<{ success: boolean }> {
    return apiClient.post("/pharmacy/dispensing", { prescriptionId, allocations });
  },

  async returnMedication(
    dispensingId: string,
    stockBatchId: string,
    quantity: number,
    reason: string
  ): Promise<{ success: boolean }> {
    return apiClient.post("/pharmacy/returns", { dispensingId, stockBatchId, quantity, reason });
  },
};
