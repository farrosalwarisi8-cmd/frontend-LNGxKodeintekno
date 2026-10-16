"use client";

import { Can } from "@/components/can";

import { useMemo, useState } from "react";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { syncInventory, useSyncedModules } from "@/lib/remote-sync";
import { useStore } from "@/lib/store";
import { resolveScope } from "@/lib/services/reference.service";
import {
  pharmacyService,
  dispensingGuard,
  resolvePharmacySiteScope,
  CrossSiteActionError,
  type BackendPrescriptionItem,
  type PharmacySiteContext,
} from "@/lib/services/pharmacy.service";
import { Pill, Search, CheckCircle, AlertTriangle, TrendingDown, ScrollText } from "lucide-react";
import {
  buildStockHints,
  summarizeDispenseWarnings,
  FEFO_WARN_DAYS,
} from "@/features/pharmacy/stock-hints";
import { todayIso } from "@/shared/utils/due-soon";
import { diffStockLedger, type BackendInventoryItem, type StockLedgerEntry } from "@/lib/services/pharmacy.service";

interface PendingRx {
  id: string;
  visitNumber: string;
  patientName: string;
  mrn: string;
  prescribedAt: string;
  items: BackendPrescriptionItem[];
}

export default function DispensePage() {
  const [prescriptions, setPrescriptions] = useState<PendingRx[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRx, setSelectedRx] = useState<PendingRx | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  // Fase 5 — snapshot inventory sebelum dispensing untuk membuktikan perubahan stok
  const [stockSnapshot, setStockSnapshot] = useState<BackendInventoryItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);

  const load = async () => {
    // Fase 4 — resep pending di-scope ke site aktif (query ?siteId=).
    const siteId = useStore.getState().activeSiteId ?? undefined;
    const rows = await pharmacyService.getPendingPrescriptions(siteId);
    const mapped: PendingRx[] = rows.map((p) => ({
      id: p.id,
      visitNumber: `RX-${p.id.slice(0, 8).toUpperCase()}`,
      patientName: p.encounter?.patient?.full_name ?? "Pasien",
      mrn: p.encounter?.patient?.medical_record_no ?? "",
      prescribedAt: p.prescribed_at ?? "",
      items: p.items ?? [],
    }));
    setPrescriptions(mapped);
    await syncInventory();
    // Fase 5 — snapshot inventory untuk stock ledger dispensing
    const inventory = await pharmacyService.getInventory(siteId);
    setStockSnapshot(inventory);
  };

  const { loading, error, refetch } = useSyncedModules(load);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prescriptions.filter(
      (p) => !q || p.visitNumber.toLowerCase().includes(q) || p.patientName.toLowerCase().includes(q)
    );
  }, [prescriptions, search]);

  // Peringatan stok & FEFO dihitung dari snapshot inventaris site ini,
  // memakai jumlah yang sedang diisi apoteker (bukan jumlah resep asli).
  const stockHints = selectedRx
    ? buildStockHints(
        selectedRx.items.map((item) => ({
          itemId: item.id,
          name: item.medication?.generic_name,
          quantity: quantities[item.id] ?? item.quantity ?? 0,
        })),
        stockSnapshot,
        { today: todayIso() }
      )
    : [];
  const warnings = summarizeDispenseWarnings(stockHints);
  const hintFor = (itemId: string) => stockHints.find((h) => h.itemId === itemId);

  const openDispense = (rx: PendingRx) => {
    setSelectedRx(rx);
    setQuantities(Object.fromEntries(rx.items.map((i) => [i.id, i.quantity ?? 1])));
    setMessage(null);
    setShowModal(true);
  };

  /**
   * Alur dispensing backend:
   *  1. POST /api/v1/pharmacy/dispensing/recommend-batches (engine FEFO per obat)
   *  2. POST /api/v1/pharmacy/dispensing (transaksi atomik + pessimistic lock)
   *
   * Fase 3 — dispensing tidak terjadi dua kali:
   *  - DispensingGuard menolak permintaan kedua untuk resep yang sama
   *    (in-flight atau sudah selesai) SEBELUM request dikirim.
   *  - Cross-site guard memastikan FEFO/dispensing hanya menargetkan
   *    site dalam cakupan apoteker.
   *  - Setelah sukses, resep dihapus dari antrean lokal + refetch
   *    (backend juga menyembunyikan resep yang sudah ada dispensing-nya).
   */
  const handleDispense = async () => {
    if (!selectedRx) return;
    // Anti double-submit: guard menolak bila resep sudah/m sedang diproses.
    if (!dispensingGuard.begin(selectedRx.id)) {
      setMessage({
        type: "error",
        text: dispensingGuard.isDispensed(selectedRx.id)
          ? "Resep ini sudah didispensasi — tidak dapat diproses dua kali."
          : "Dispensing resep ini sedang berjalan. Tunggu hingga selesai.",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const scope = await resolveScope();
      // Cakupan site apoteker — aksi lintas site ditolak di sini.
      const siteContext: PharmacySiteContext = {
        siteId: scope.siteId,
        siteName: scope.siteName,
      };
      await resolvePharmacySiteScope(); // pastikan cakupan terverifikasi
      const byBatch = new Map<string, number>();

      for (const item of selectedRx.items) {
        const medicationId = item.medication_id;
        if (!medicationId) continue;
        const qty = quantities[item.id] ?? item.quantity ?? 0;
        if (qty <= 0) continue;

        const rec = await pharmacyService.recommendBatches(
          medicationId,
          scope.siteId,
          qty,
          siteContext
        );
        if (!rec.isFullyAllocatable) {
          throw new Error(
            `Stok ${item.medication?.generic_name ?? "obat"} tidak mencukupi (kurang ${rec.shortfall}).`
          );
        }
        for (const batch of rec.recommendedBatches) {
          byBatch.set(batch.batchId, (byBatch.get(batch.batchId) ?? 0) + batch.allocated);
        }
      }

      if (byBatch.size === 0) {
        throw new Error("Tidak ada item obat untuk dispense.");
      }

      const allocations = Array.from(byBatch.entries()).map(([stockBatchId, quantity]) => ({
        stockBatchId,
        quantity,
      }));

      await pharmacyService.dispense(selectedRx.id, allocations, siteContext);
      // Resep resmi selesai didispensasi — terkunci untuk sesi ini.
      dispensingGuard.commit(selectedRx.id);

      // Fase 5 — hitung selisih stok (DISPENSING) dari snapshot sebelum/sesudah
      const siteId = useStore.getState().activeSiteId ?? undefined;
      const newInventory = await pharmacyService.getInventory(siteId);
      const entries = diffStockLedger(stockSnapshot, newInventory, "DISPENSING");
      setLedgerEntries((prev) => [...entries, ...prev]);
      setStockSnapshot(newInventory);

      const entrySummary =
        entries.length > 0
          ? ` Stok berkurang: ${entries.map((e) => `${e.genericName} (${e.before}→${e.after})`).join(", ")}.`
          : "";
      setMessage({
        type: "ok",
        text: `Dispensing berhasil diproses oleh backend.${entrySummary}`,
      });
      setPrescriptions((prev) => prev.filter((p) => p.id !== selectedRx.id));
      setTimeout(() => {
        setShowModal(false);
        refetch();
      }, 900);
    } catch (e) {
      dispensingGuard.rollback(selectedRx.id);
      setMessage({
        type: "error",
        text:
          e instanceof CrossSiteActionError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Dispensing gagal.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dispensing Obat</h1>
        <p className="text-sm text-slate-500">
          FEFO dispensing dari resep aktif backend (GET /pharmacy/prescriptions/pending)
        </p>
      </div>

      {/* Fase 5 — Stock Ledger: bukti perubahan stok (DISPENSING) */}
      {ledgerEntries.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Stock Ledger — Dispensing
            </h2>
          </div>
          <div className="space-y-2">
            {ledgerEntries.map((entry, i) => (
              <div
                key={`${entry.recordedAt}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {entry.genericName}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      ({entry.medicationCode}) · {entry.siteName}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(entry.recordedAt)} · movement: {entry.movement}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    {entry.before}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {entry.after}
                  </span>
                  <Badge variant="danger">
                    <TrendingDown className="size-3" />
                    {entry.delta}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Cari resep / pasien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} resep menunggu dispensing</p>

      {error && <ErrorState title="Gagal memuat resep dari backend" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto mb-3 size-8 text-success-600" />
          <p className="text-sm text-slate-500">Tidak ada resep yang menunggu dispensing.</p>
        </Card>
      ) : !loading && !error ? (
        <div className="space-y-3">
          {filtered.map((rx) => (
            <Card key={rx.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Pill className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{rx.patientName}</p>
                    <p className="text-xs text-slate-500">
                      {rx.visitNumber} · {rx.mrn || "—"} ·{" "}
                      {rx.prescribedAt ? formatDate(rx.prescribedAt) : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rx.items.length} item obat
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {dispensingGuard.isDispensed(rx.id) ? (
                    <Badge variant="success">Terdispensasi</Badge>
                  ) : (
                    <Badge variant="warning">Menunggu</Badge>
                  )}
                  <Can action="pharmacy.dispense">
                    <Button
                      size="sm"
                      onClick={() => openDispense(rx)}
                      disabled={
                        dispensingGuard.isDispensed(rx.id) ||
                        dispensingGuard.isInProgress(rx.id)
                      }
                    >
                      <Pill className="size-3.5" />
                      Dispense
                    </Button>
                  </Can>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Dispensing Obat (FEFO)"
        description={selectedRx ? `${selectedRx.visitNumber} — ${selectedRx.patientName}` : ""}
        size="lg"
      >
        <div className="space-y-4">
          {/* Peringatan stok/FEFO ditempatkan paling atas: apoteker harus
              melihatnya sebelum menekan tombol proses. */}
          {selectedRx && (
            <div
              role="status"
              className={`rounded-xl p-3 text-sm ${
                warnings.blocked
                  ? "bg-danger-50 text-danger-700"
                  : warnings.expiringSoon.length > 0 || warnings.lowStock.length > 0
                    ? "bg-warning-50 text-warning-700"
                    : "bg-success-50 text-success-700"
              }`}
            >
              <p className="flex items-start gap-2 font-medium">
                {warnings.blocked ? (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                )}
                {warnings.summary}
              </p>
              {warnings.blocked && (
                <p className="mt-1 text-xs">
                  Transaksi ini pasti ditolak backend. Kurangi jumlah atau terima stok dulu.
                </p>
              )}
              {warnings.expiringSoon.length > 0 && (
                <p className="mt-1 text-xs">
                  FEFO memakai batch dengan kadaluarsa terdekat (≤ {FEFO_WARN_DAYS} hari).
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {selectedRx?.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {item.medication?.generic_name ?? item.medication_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.medication?.strength ?? ""} {item.dosage ?? ""}
                  </p>
                  {(() => {
                    const hint = hintFor(item.id);
                    if (!hint) return null;
                    return (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant={hint.currentStock === null ? "outline" : hint.shortfall > 0 ? "danger" : "success"}>
                          Stok: {hint.currentStock ?? "tidak diketahui"}
                        </Badge>
                        {hint.nearestExpiryDate && (
                          <Badge variant={hint.expiresSoon ? "warning" : "outline"}>
                            FEFO {formatDate(hint.nearestExpiryDate)}
                          </Badge>
                        )}
                        {hint.shortfall > 0 && (
                          <Badge variant="danger">Kurang {hint.shortfall}</Badge>
                        )}
                        {hint.isLowStock && hint.shortfall === 0 && (
                          <Badge variant="warning">Stok minimum</Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <Input
                  label=""
                  type="number"
                  className="w-24"
                  value={String(quantities[item.id] ?? item.quantity ?? 1)}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            Batch dipilih otomatis oleh engine FEFO backend (tanggal kadaluarsa terdekat).
          </div>

          {message && (
            <div
              className={`rounded-xl p-3 text-sm ${
                message.type === "ok"
                  ? "bg-success-50 text-success-700"
                  : "bg-danger-50 text-danger-700"
              }`}
            >
              {message.type === "error" && (
                <AlertTriangle className="mr-1 inline size-4 align-[-2px]" />
              )}
              {message.text}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={busy}>
              Batal
            </Button>
            <Can action="pharmacy.dispense">
              <Button
                onClick={handleDispense}
                loading={busy}
                disabled={busy || warnings.blocked}
              >
                <CheckCircle className="size-4" />
                Proses Dispensing
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
