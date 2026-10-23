import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserStubs, mockFetch, envelope } from "./helpers";
import {
  BackendFeatureUnavailableError,
  isBackendFeatureUnavailable,
} from "@/lib/services/backend-availability";
import { ApiError } from "@/lib/api-client";

installBrowserStubs();

/**
 * Kontrak ketersediaan: route yang TIDAK terdaftar di backend NestJS saat ini
 * harus menjadi `BackendFeatureUnavailableError` (bukan ApiError mentah),
 * sedangkan 404 entity biasa TIDAK boleh disamarkan sebagai kekurangan backend.
 */
describe("ketersediaan endpoint backend", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("GET /diagnostic/lab-orders yang belum terdaftar → error kapabilitas", async () => {
    const calls = mockFetch(() => ({
      status: 404,
      body: {
        success: false,
        statusCode: 404,
        error: "Not Found",
        message: "Cannot GET /api/v1/diagnostic/lab-orders",
      },
    }));
    const { diagnosticService } = await import("@/lib/services/diagnostic.service");

    await expect(diagnosticService.listLabOrders()).rejects.toBeInstanceOf(
      BackendFeatureUnavailableError
    );
    await expect(diagnosticService.listLabOrders()).rejects.toThrow(
      /Daftar order laboratorium belum tersedia di backend/
    );
    // Request tetap dikirim sekali agar fitur otomatis hidup saat backend
    // menambahkan route-nya (tidak ada cache "mati" di klien).
    expect(calls.length).toBe(2);
  });

  it("404 entity pada detail order BUKAN kekurangan backend", async () => {
    mockFetch(() => ({
      status: 404,
      body: { success: false, statusCode: 404, message: "Lab order not found" },
    }));
    const { diagnosticService } = await import("@/lib/services/diagnostic.service");

    const error = await diagnosticService
      .getLabOrder("order-1")
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(isBackendFeatureUnavailable(error)).toBe(false);
    expect((error as ApiError).status).toBe(404);
  });

  it("GET /signatures & /pharmacy/dispensing/history yang belum terdaftar → error kapabilitas", async () => {
    mockFetch((req) => ({
      status: 404,
      body: {
        success: false,
        statusCode: 404,
        message: `Cannot GET ${new URL(req.url).pathname}`,
      },
    }));
    const { documentService } = await import("@/lib/services/document.service");
    const { pharmacyService } = await import("@/lib/services/pharmacy.service");

    await expect(documentService.getSignatures()).rejects.toBeInstanceOf(
      BackendFeatureUnavailableError
    );
    await expect(pharmacyService.getDispensingHistory()).rejects.toBeInstanceOf(
      BackendFeatureUnavailableError
    );
  });

  it("unggah dokumen tidak mengirim request ke route yang belum ada", async () => {
    const calls = mockFetch(() => ({ body: envelope({}) }));
    const { documentService } = await import("@/lib/services/document.service");

    await expect(
      documentService.uploadDocument({ name: "berkas.pdf" } as File)
    ).rejects.toBeInstanceOf(BackendFeatureUnavailableError);
    expect(calls.length).toBe(0);
  });
});
