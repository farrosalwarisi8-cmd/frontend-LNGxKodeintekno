import { ApiError } from "@/lib/api-client";

/**
 * Kontrak ketersediaan endpoint backend.
 *
 * Sumber kebenaran: route yang benar-benar terdaftar di backend NestJS
 * (`KODEINxLNG-Backend/src/modules/**`). Frontend TIDAK boleh mengarang data
 * atau menampilkan "berhasil" ketika route belum ada. Modul di bawah ini
 * memusatkan dua hal:
 *
 *  1. daftar operasi yang route-nya belum terdaftar di backend saat ini;
 *  2. penerjemahan route-404 NestJS ("Cannot GET/POST ...") menjadi error
 *     bertipe, sehingga UI dapat menampilkan penjelasan kapabilitas —
 *     bukan pesan mentah "Cannot GET /api/v1/..." atau ErrorState generik.
 *
 * Bila backend menambahkan route tersebut, pemetaan ini tidak perlu diubah:
 * respons 2xx tetap mengalir normal dan error ini tidak pernah dilempar.
 */

export interface BackendUnavailableFeature {
  /** Nama fitur dalam bahasa pengguna. */
  readonly feature: string;
  /** Route yang dibutuhkan (ditulis method + path). */
  readonly endpoints: readonly string[];
  /** Penjelasan tambahan opsional untuk UI. */
  readonly hint?: string;
}

export const BACKEND_UNAVAILABLE = {
  labOrderList: {
    feature: "Daftar order laboratorium",
    endpoints: ["GET /diagnostic/lab-orders"],
  },
  labOrderDetail: {
    feature: "Detail order laboratorium",
    endpoints: ["GET /diagnostic/lab-orders/:id"],
  },
  labResultList: {
    feature: "Daftar hasil laboratorium",
    endpoints: ["GET /diagnostic/lab-results"],
  },
  radiologyOrderList: {
    feature: "Daftar order radiologi",
    endpoints: ["GET /diagnostic/radiology-orders"],
  },
  radiologyOrderDetail: {
    feature: "Detail order radiologi",
    endpoints: ["GET /diagnostic/radiology-orders/:id"],
  },
  signatureTracking: {
    feature: "Pelacakan tanda tangan elektronik",
    endpoints: [
      "GET /signatures",
      "GET /signatures/:id",
      "POST /signatures/:id/retry",
    ],
    hint: "Permintaan tanda tangan baru tetap dapat dikirim lewat POST /signatures/request.",
  },
  documentDownload: {
    feature: "Unduh dokumen",
    endpoints: ["GET /documents/:id/download"],
  },
  documentUpload: {
    feature: "Unggah dokumen pendukung",
    endpoints: ["POST /documents/upload"],
    hint: "Pendaftaran pekerja tetap dapat disimpan tanpa lampiran.",
  },
  dispensingHistory: {
    feature: "Riwayat dispensing obat",
    endpoints: ["GET /pharmacy/dispensing/history"],
    hint: "Stok obat (GET /pharmacy/inventory) tetap dapat dipantau.",
  },
} as const satisfies Record<string, BackendUnavailableFeature>;

export type BackendUnavailableKey = keyof typeof BACKEND_UNAVAILABLE;

/**
 * Dilempar saat UI membutuhkan operasi yang route backend-nya belum terdaftar.
 *
 * Dipisahkan dari `ApiError` agar pemanggil dapat membedakan "backend belum
 * menyediakan fitur" dari "request gagal" (401/403/409/500) dan tidak
 * menawarkan tombol "Coba lagi" yang pasti gagal.
 */
export class BackendFeatureUnavailableError extends Error {
  readonly feature: string;
  readonly endpoints: string[];

  constructor(info: BackendUnavailableFeature) {
    super(
      `${info.feature} belum tersedia di backend saat ini ` +
        `(${info.endpoints.join(", ")} belum terdaftar). ` +
        (info.hint ?? "Frontend tidak menampilkan data pengganti.")
    );
    this.name = "BackendFeatureUnavailableError";
    this.feature = info.feature;
    this.endpoints = [...info.endpoints];
  }
}

export function isBackendFeatureUnavailable(
  value: unknown
): value is BackendFeatureUnavailableError {
  return value instanceof BackendFeatureUnavailableError;
}

/** True bila error berasal dari route NestJS yang tidak terdaftar. */
export function isRouteMissingError(value: unknown): boolean {
  if (!(value instanceof ApiError) || value.status !== 404) return false;
  return /\bCannot (GET|POST|PUT|PATCH|DELETE)\b/i.test(value.message);
}

/**
 * Melempar error kapabilitas bila kegagalan adalah route-404, selain itu
 * meneruskan error asli (validasi, 403, 404 entity, 500, offline).
 *
 * Selalu melempar — dipakai di blok `catch` sehingga tipe kembaliannya `never`.
 */
export function rethrowWithAvailability(
  error: unknown,
  info: BackendUnavailableFeature
): never {
  if (isRouteMissingError(error)) {
    throw new BackendFeatureUnavailableError(info);
  }
  throw error;
}
