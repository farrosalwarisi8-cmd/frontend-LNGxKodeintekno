import { apiClient, getToken } from "@/lib/api-client";
import type { BackendUserRow } from "@/lib/services/iam.service";

/**
 * Modul 5 — Farmasi & FEFO Inventory Engine.
 * Endpoint backend (Domain 6):
 *   GET  /api/v1/pharmacy/inventory?siteId=
 *   GET  /api/v1/pharmacy/prescriptions/pending?siteId=
 *   GET  /api/v1/pharmacy/dispensing/history
 *   POST /api/v1/pharmacy/dispensing/recommend-batches
 *   POST /api/v1/pharmacy/dispensing
 *   POST /api/v1/pharmacy/returns
 *
 * Fase 3 — pengamanan alur pharmacy di lapisan frontend:
 *   1. DispensingGuard   — satu resep hanya boleh didispensasi sekali
 *                          per sesi (anti double-submit + idempotensi UI).
 *   2. Cross-site guard  — aksi farmasi (recommend/dispense/return) hanya
 *                          boleh menargetkan site dalam cakupan user.
 *                          Cakupan diselesaikan dari data yang DIIZINKAN
 *                          backend sendiri (bukan dari klaim klien).
 *   3. Stock ledger      — snapshot stok sebelum/sesudah transaksi agar
 *                          perubahan ledger (DISPENSING/RETURN) dapat
 *                          dibuktikan dari UI.
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

// ---------------------------------------------------------------------------
// 1. DispensingGuard — dispensing tidak terjadi dua kali
// ---------------------------------------------------------------------------

/**
 * Pengawal dispensing per sesi aplikasi.
 *
 * Backend tidak menolak permintaan dispensing kedua untuk resep yang sama
 * (kontrak idempotensi belum ada di endpoint), sehingga lapisan frontend
 * wajib memastikan satu resep hanya didispensasi SEKALI:
 *   - `begin()`  : false bila resep sudah pernah/m sedang diproses → UI
 *                  menonaktifkan aksi dan TIDAK mengirim request.
 *   - `commit()` : resep selesai didispensasi (selamanya terkunci sesi ini).
 *   - `rollback()`：batal saat gagal, sehingga bisa dicoba ulang.
 */
export class DispensingGuard {
  private readonly inFlight = new Set<string>();
  private readonly completed = new Set<string>();

  /** Mulai dispensing. false = ditolak (sudah pernah/m sedang berjalan). */
  begin(prescriptionId: string): boolean {
    if (!prescriptionId) return false;
    if (this.completed.has(prescriptionId) || this.inFlight.has(prescriptionId)) {
      return false;
    }
    this.inFlight.add(prescriptionId);
    return true;
  }

  commit(prescriptionId: string): void {
    this.inFlight.delete(prescriptionId);
    if (prescriptionId) this.completed.add(prescriptionId);
  }

  rollback(prescriptionId: string): void {
    this.inFlight.delete(prescriptionId);
  }

  isDispensed(prescriptionId: string): boolean {
    return this.completed.has(prescriptionId);
  }

  isInProgress(prescriptionId: string): boolean {
    return this.inFlight.has(prescriptionId);
  }

  /** Reset penuh (dipakai test). */
  reset(): void {
    this.inFlight.clear();
    this.completed.clear();
  }
}

/** Instance guard per sesi aplikasi (module singleton). */
export const dispensingGuard = new DispensingGuard();

// ---------------------------------------------------------------------------
// 2. Cross-site guard — aksi lintas site ditolak
// ---------------------------------------------------------------------------

export interface PharmacySiteContext {
  siteId?: string;
  siteName?: string;
}

export class CrossSiteActionError extends Error {
  constructor(
    public readonly target: PharmacySiteContext,
    public readonly scope: PharmacySiteScope
  ) {
    const targetLabel = target.siteName ?? target.siteId ?? "site tidak dikenal";
    const allowed =
      scope.siteNames.length > 0
        ? scope.siteNames.join(", ")
        : "tidak ada site dalam cakupan";
    super(
      `Aksi lintas site ditolak: ${targetLabel} tidak termasuk dalam cakupan Anda (${allowed}).`
    );
    this.name = "CrossSiteActionError";
  }
}

export interface PharmacySiteScope {
  /** true = role GLOBAL (SYSTEM_ADMIN) — seluruh site diizinkan. */
  unrestricted: boolean;
  /** Site ID yang diizinkan (dari /iam/users — admin/HR). */
  siteIds: string[];
  /** Nama site yang diizinkan (dari inventory yang bisa dibaca user). */
  siteNames: string[];
}

/** Peran backend yang punya cakupan GLOBAL (seluruh site). */
const GLOBAL_ROLES = new Set(["SYSTEM_ADMIN", "MANAGEMENT", "HSE_MANAGER", "DOCTOR_OH"]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function currentUsername(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const username = payload?.username;
  return typeof username === "string" ? username : null;
}

let scopeCache: { token: string; scope: PharmacySiteScope } | null = null;

/**
 * Menyelesaikan cakupan site pengguna untuk aksi farmasi.
 *
 * Sumber kebenaran adalah data yang DIIZINKAN backend — bukan klaim
 * parameter `siteId` dari klien:
 *   1. Admin/HR dapat membaca `GET /iam/users` → `user_roles[].site`
 *      (akurat, termasuk deteksi role GLOBAL → unrestricted).
 *   2. Peran site-scoped (apoteker) tidak dapat membaca /iam/users,
 *      sehingga cakupan diambil dari `GET /pharmacy/inventory` tanpa
 *      parameter — backend secara otomatis hanya mengembalikan inventory
 *      site milik user. Nama site hasil baca itulah yang menjadi cakupan.
 *
 * Gagal total (tanpa akses baca apa pun) → scope kosong → fail-closed:
 * seluruh aksi tulis farmasi ditolak.
 */
export async function resolvePharmacySiteScope(
  force = false
): Promise<PharmacySiteScope> {
  const token = getToken() ?? "";
  if (!force && scopeCache && scopeCache.token === token) {
    return scopeCache.scope;
  }

  // 1) Admin/HR — cakupan akurat dari registry user
  try {
    const res = await apiClient.getPaged<BackendUserRow[]>("/iam/users?page=1&limit=100");
    const username = currentUsername();
    const me = (res.data ?? []).find((u) => u.username === username);
    if (me) {
      const roleCodes = (me.user_roles ?? [])
        .map((r) => r.role?.code)
        .filter((c): c is string => Boolean(c));
      if (roleCodes.some((r) => GLOBAL_ROLES.has(r))) {
        scopeCache = { token, scope: { unrestricted: true, siteIds: [], siteNames: [] } };
        return scopeCache.scope;
      }
      const siteIds = Array.from(
        new Set((me.user_roles ?? []).map((r) => r.site?.id).filter((id): id is string => Boolean(id)))
      );
      const siteNames = Array.from(
        new Set((me.user_roles ?? []).map((r) => r.site?.name).filter((n): n is string => Boolean(n)))
      );
      const scope: PharmacySiteScope = { unrestricted: false, siteIds, siteNames };
      scopeCache = { token, scope };
      return scope;
    }
  } catch {
    /* bukan admin/HR (403) — lanjut ke fallback */
  }

  // 2) Fallback site-scoped — inventory yang diizinkan backend untuk user ini
  try {
    const items = await pharmacyService.getInventory();
    const siteNames = Array.from(
      new Set(items.map((i) => i.siteName).filter((n): n is string => Boolean(n)))
    );
    const scope: PharmacySiteScope = { unrestricted: false, siteIds: [], siteNames };
    scopeCache = { token, scope };
    return scope;
  } catch {
    /* tidak ada akses baca pharmacy — fail-closed */
  }

  const scope: PharmacySiteScope = { unrestricted: false, siteIds: [], siteNames: [] };
  scopeCache = { token, scope };
  return scope;
}

/** Membersihkan cache cakupan (ganti akun / keluar). */
export function clearPharmacySiteScopeCache(): void {
  scopeCache = null;
}

/**
 * Menolak aksi farmasi yang menargetkan site di luar cakupan user.
 * Dipanggil sebelum request dikirim — sehingga aksi lintas site
 * tidak pernah meninggalkan lapisan frontend.
 */
export function assertPharmacySite(
  scope: PharmacySiteScope,
  target: PharmacySiteContext
): void {
  if (scope.unrestricted) return;

  const hasAnyAllowedSite = scope.siteIds.length > 0 || scope.siteNames.length > 0;
  if (!hasAnyAllowedSite) {
    throw new CrossSiteActionError(target, scope);
  }

  if (target.siteId && scope.siteIds.includes(target.siteId)) return;

  if (
    target.siteName &&
    scope.siteNames.some(
      (n) => n.trim().toLowerCase() === target.siteName!.trim().toLowerCase()
    )
  ) {
    return;
  }

  throw new CrossSiteActionError(target, scope);
}

/** Menyelesaikan cakupan lalu memvalidasi target (helper 1 baris untuk UI). */
export async function requirePharmacySite(target: PharmacySiteContext): Promise<PharmacySiteScope> {
  const scope = await resolvePharmacySiteScope();
  assertPharmacySite(scope, target);
  return scope;
}

// ---------------------------------------------------------------------------
// 3. Stock ledger — bukti perubahan stok (DISPENSING / RETURN)
// ---------------------------------------------------------------------------

export interface StockLedgerEntry {
  medicationCode: string;
  genericName: string;
  siteName: string;
  before: number;
  after: number;
  delta: number;
  movement: "DISPENSING" | "RETURN";
  recordedAt: string;
}

/**
 * Membandingkan snapshot inventory sebelum & sesudah transaksi farmasi.
 * Selisihnya adalah entri stock ledger yang dapat ditampilkan UI:
 *   - dispensing → delta negatif (stok berkurang)
 *   - return     → delta positif  (stok dikembalikan)
 */
export function diffStockLedger(
  before: BackendInventoryItem[],
  after: BackendInventoryItem[],
  movement: "DISPENSING" | "RETURN"
): StockLedgerEntry[] {
  const afterById = new Map(after.map((i) => [i.id, i]));
  const entries: StockLedgerEntry[] = [];

  for (const item of before) {
    const current = afterById.get(item.id);
    if (!current) continue;
    const beforeStock = Number(item.currentStock ?? 0);
    const afterStock = Number(current.currentStock ?? 0);
    if (beforeStock === afterStock) continue;
    entries.push({
      medicationCode: item.medicationCode,
      genericName: item.genericName,
      siteName: item.siteName,
      before: beforeStock,
      after: afterStock,
      delta: afterStock - beforeStock,
      movement,
      recordedAt: new Date().toISOString(),
    });
  }
  return entries;
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

  /**
   * Rekomendasi batch FEFO.
   *
   * Cross-site guard: target site (siteId/siteName) divalidasi terhadap
   * cakupan user TERLEBIH DAHULU — request ke backend hanya dikirim
   * bila site termasuk cakupan. `siteContext` opsional; bila tidak diberikan,
   * validasi tetap berjalan (fail-closed untuk user site-scoped).
   */
  async recommendBatches(
    medicationId: string,
    siteId: string,
    requiredQuantity: number,
    siteContext?: PharmacySiteContext
  ): Promise<FefoRecommendation> {
    const scope = await resolvePharmacySiteScope();
    assertPharmacySite(scope, siteContext ?? { siteId });
    return apiClient.post<FefoRecommendation>("/pharmacy/dispensing/recommend-batches", {
      medicationId,
      siteId,
      requiredQuantity,
    });
  },

  /**
   * Dispensing atomik.
   *
   * Dua lapis anti-duplikasi:
   *   1. DispensingGuard (pemanggil harus `begin()` lebih dulu) — lihat
   *      halaman dispense; guard menolak permintaan kedua untuk resep sama.
   *   2. Cross-site guard pada site konteks resep.
   */
  async dispense(
    prescriptionId: string,
    allocations: Array<{ stockBatchId: string; quantity: number }>,
    siteContext?: PharmacySiteContext
  ): Promise<{ id?: string; prescription_id?: string }> {
    const scope = await resolvePharmacySiteScope();
    // User site-scoped WAJIB menyertakan konteks site — tanpa itu
    // tidak ada cara memverifikasi tujuan dispensing (fail-closed).
    if (!scope.unrestricted && !siteContext) {
      throw new CrossSiteActionError(
        { siteId: prescriptionId },
        scope
      );
    }
    if (siteContext) {
      assertPharmacySite(scope, siteContext);
    }
    return apiClient.post("/pharmacy/dispensing", { prescriptionId, allocations });
  },

  /**
   * Retur obat ke inventory + stock movement ledger.
   * Cross-site guard berlaku sama: hanya untuk dispensing/batch dalam
   * cakupan site user.
   */
  async returnMedication(
    dispensingId: string,
    stockBatchId: string,
    quantity: number,
    reason: string,
    siteContext?: PharmacySiteContext
  ): Promise<unknown> {
    const scope = await resolvePharmacySiteScope();
    // User site-scoped WAJIB menyertakan konteks site (fail-closed).
    if (!scope.unrestricted && !siteContext) {
      throw new CrossSiteActionError(
        { siteId: dispensingId },
        scope
      );
    }
    if (siteContext) {
      assertPharmacySite(scope, siteContext);
    }
    return apiClient.post("/pharmacy/returns", {
      dispensingId,
      stockBatchId,
      quantity,
      reason,
    });
  },

  async getDispensingHistory(): Promise<DispensingHistoryItem[]> {
    return apiClient.get<DispensingHistoryItem[]>("/pharmacy/dispensing/history");
  },
};

export interface DispensingHistoryItem {
  id: string;
  prescription_id?: string;
  dispensed_by?: string | null;
  status?: string;
  dispensed_at?: string;
  prescription?: {
    id: string;
    encounter_id?: string | null;
    status?: string;
    encounter?: {
      id?: string;
      patient_id?: string;
      patient?: { id?: string; full_name?: string; medical_record_no?: string };
    } | null;
    items?: Array<{
      id: string;
      medication_id?: string;
      quantity?: number;
      medication?: { id?: string; code?: string; generic_name?: string };
    }>;
  } | null;
  dispensing_items?: Array<{
    id: string;
    stock_batch_id?: string;
    quantity?: number;
    stock_batch?: {
      id?: string;
      batch_no?: string;
      expiry_date?: string;
      quantity_available?: number;
    } | null;
  }>;
  medication_returns?: Array<{
    id: string;
    dispensing_id?: string;
    stock_batch_id?: string;
    quantity?: number;
    reason?: string;
    returned_at?: string;
  }>;
}
