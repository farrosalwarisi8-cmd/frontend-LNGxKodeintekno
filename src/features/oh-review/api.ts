/**
 * A3 — Klien API untuk layar review MCU (Dokter OH).
 *
 * Hanya memakai endpoint yang SUDAH ADA di klien API repo ini:
 *  - GET  /mcu/cycles                       (antrean review + detail siklus)
 *  - POST /mcu/cycles/:id/ftw-assessment    (penetapan FTW)
 *  - POST /mcu/restrictions/:id/close       (akhiri restriksi kerja)
 *  - GET  /documents                        (status resume & sertifikat)
 *  - GET  /diagnostic/lab-orders            (hasil penunjang terverifikasi, read-only)
 *  - GET  /diagnostic/lab-results           (hasil penunjang terverifikasi, read-only)
 *
 * Tidak ada endpoint/field baru yang dipalsukan. Hal yang tidak tersedia
 * dari API dicatat sebagai BLOCKER BACKEND di LAPORAN_A3_OH_REVIEW_DNA.md.
 */
import {
  mcuService,
  type BackendMcuCycle,
  type FtwStatus,
} from "@/lib/services/mcu.service";
import { documentService, type BackendDocument } from "@/lib/services/document.service";
import {
  diagnosticService,
  type BackendLabOrder,
  type BackendLabResult,
} from "@/lib/services/diagnostic.service";

export interface ReviewCycleQuery {
  page?: number;
  limit?: number;
  search?: string;
  ftwStatus?: FtwStatus;
}

export interface ReviewCyclePage {
  cycles: BackendMcuCycle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Ambil daftar siklus MCU untuk antrean review. */
export async function fetchReviewCycles(
  query: ReviewCycleQuery = {}
): Promise<ReviewCyclePage> {
  const res = await mcuService.list({
    page: query.page ?? 1,
    limit: query.limit ?? 100,
    search: query.search,
    ftwStatus: query.ftwStatus,
  });
  return {
    cycles: res.data ?? [],
    total: res.meta?.total ?? (res.data ?? []).length,
    page: res.meta?.page ?? query.page ?? 1,
    limit: res.meta?.limit ?? query.limit ?? 100,
    totalPages: res.meta?.totalPages ?? 1,
  };
}

export interface FtwRestrictionInput {
  description: string;
  reviewDate: string;
  supervisor?: string;
  controls?: string;
}

/** Kirim penetapan FTW (Dokter OH). */
export async function submitFtwAssessment(input: {
  cycleId: string;
  ftwStatus: FtwStatus;
  summary?: string;
  restriction?: FtwRestrictionInput;
}): Promise<void> {
  await mcuService.assessFtw(
    input.cycleId,
    input.ftwStatus,
    input.summary,
    input.restriction
  );
}

/** Akhiri (tutup) restriksi kerja. */
export async function closeRestriction(restrictionId: string): Promise<void> {
  await mcuService.closeRestriction(restrictionId);
}

/**
 * Daftar dokumen resmi (resume & sertifikat) untuk mencari status dokumen
 * yang terkait dengan satu siklus MCU.
 *
 * Catatan kontrak: `Document` tidak menyimpan `referenceId`; backend hanya
 * menyimpan judul dokumen. Pencocokan dilakukan pada judul yang memuat nomor
 * MCU — konvensi yang sama dipakai sinkronisasi sertifikat di repo ini.
 */
export async function fetchDocuments(): Promise<BackendDocument[]> {
  const res = await documentService.getDocuments({ page: 1, limit: 100 });
  return res.data ?? [];
}

/** Cari dokumen yang terkait dengan satu siklus MCU (berdasarkan nomor MCU). */
export function findDocumentForCycle(
  documents: readonly BackendDocument[],
  mcuNumber: string
): BackendDocument | null {
  if (!mcuNumber) return null;
  const needle = mcuNumber.toLowerCase();
  return (
    documents.find((document) => (document.title ?? "").toLowerCase().includes(needle)) ?? null
  );
}

/** Hasil penunjang terverifikasi (lab) yang terkait dengan satu siklus MCU. */
export interface SupportingResult {
  resultId: string;
  parameterName: string;
  value: string;
  unit: string | null;
  abnormalFlag: boolean | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface SupportingResultsBundle {
  results: SupportingResult[];
  /** Alasan bila data penunjang tidak dapat ditampilkan. */
  unavailableReason: string | null;
}

/**
 * Baca hasil penunjang yang sudah "Terverifikasi" (A2) untuk satu siklus MCU.
 *
 * Read-only: A3 tidak mengubah alur lab. Bila endpoint baca diagnostic belum
 * tersedia di backend, kembalikan alasan yang jujur — bukan data karangan.
 */
export async function fetchSupportingResults(
  cycleId: string
): Promise<SupportingResultsBundle> {
  let orders: BackendLabOrder[];
  let results: BackendLabResult[];
  try {
    [orders, results] = await Promise.all([
      diagnosticService.listLabOrders(),
      diagnosticService.listLabOrderResults(),
    ]);
  } catch {
    return {
      results: [],
      unavailableReason:
        "Endpoint baca data penunjang belum tersedia di backend, sehingga hasil terverifikasi tidak dapat ditampilkan.",
    };
  }

  const orderByItemId = new Map<string, BackendLabOrder>();
  for (const order of orders ?? []) {
    for (const item of order.order_items ?? []) {
      if (item?.id) orderByItemId.set(item.id, order);
    }
  }

  const rows: SupportingResult[] = [];
  for (const result of results ?? []) {
    const order = orderByItemId.get(result.lab_order_item_id);
    if (!order || order.mcu_cycle_id !== cycleId) continue;
    if (!result.verified_at) continue; // hanya yang sudah "Terverifikasi"
    for (const value of result.values ?? []) {
      rows.push({
        resultId: result.id,
        parameterName: value.parameter_name,
        value:
          value.numeric_value !== null && value.numeric_value !== undefined
            ? String(value.numeric_value)
            : (value.text_value ?? "—"),
        unit: value.unit ?? null,
        abnormalFlag: typeof value.abnormal_flag === "boolean" ? value.abnormal_flag : null,
        verifiedAt: result.verified_at,
        verifiedBy: result.verified_by ?? null,
      });
    }
  }

  return { results: rows, unavailableReason: null };
}
