"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import {
  pharmacyService,
  resolvePharmacySiteScope,
  CrossSiteActionError,
  diffStockLedger,
  type DispensingHistoryItem,
  type BackendInventoryItem,
  type StockLedgerEntry,
} from "@/lib/services/pharmacy.service";
import { Undo2, Search, AlertTriangle, ScrollText } from "lucide-react";
import { useStore } from "@/lib/store";

export default function ReturnMedicinePage() {
  const [history, setHistory] = useState<DispensingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Fase 6 — `GET /pharmacy/dispensing/history` BELUM ada di backend (404).
  // Dibedakan dari kegagalan lain: inventory tetap dimuat & ditampilkan,
  // tombol retur disembunyikan (tanpa baris dispensing tidak ada yang bisa
  // dipilih), dan empty state menjelaskan apa yang kurang.
  const [historyMissing, setHistoryMissing] = useState(false);
  const [inventory, setInventory] = useState<BackendInventoryItem[]>([]);
  const [search, setSearch] = useState("");

  // Fase 3 — stock ledger: snapshot inventory sebelum retur agar
  // perubahan stok (RETURN movement) dapat dibuktikan dari UI.
  const [stockSnapshot, setStockSnapshot] = useState<BackendInventoryItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedDispensing, setSelectedDispensing] = useState<DispensingHistoryItem | null>(null);
  const [returnBatchId, setReturnBatchId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fase 4 — scope site aktif: riwayat & snapshot inventory dimuat ulang saat
  // user berpindah scope, sehingga baris scope lama tidak tetap tampil.
  const scopeVersion = useStore((s) => s.scopeVersion);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHistoryMissing(false);
    const siteId = useStore.getState().activeSiteId ?? undefined;
    // Inventory diambil TERLEBIH DAHULU & terpisah dari riwayat: bila
    // `GET /pharmacy/dispensing/history` 404, inventory tetap tampil dan
    // stok tetap bisa dipantau (halaman tidak mati karena satu endpoint).
    let inventoryData: BackendInventoryItem[];
    try {
      inventoryData = await pharmacyService.getInventory(siteId);
      setInventory(inventoryData);
      setStockSnapshot(inventoryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat inventory farmasi.");
      setLoading(false);
      return;
    }

    let historyData: DispensingHistoryItem[];
    try {
      historyData = await pharmacyService.getDispensingHistory();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Route backend belum tersedia — bukan kesalahan pengguna.
        setHistory([]);
        setHistoryMissing(true);
      } else {
        setError(e instanceof Error ? e.message : "Gagal memuat riwayat dispensing.");
      }
      setLoading(false);
      return;
    }
    // Fase 4 — snapshot inventory sudah site-scoped ( ?siteId= ). Baris
    // riwayat dibuang bila batch-nya tidak termasuk inventory site aktif
    // (fail-closed: tanpa info site di baris -> dianggap luar scope).
    const scopedInventoryIds = new Set(inventoryData.map((i) => i.id));
    const scopedHistory = siteId
        ? historyData.filter((d) => {
            const items = d.dispensing_items ?? [];
            if (items.length === 0) return false;
            return items.every((it) => {
              const invId = it.stock_batch?.inventory_item_id;
              return invId ? scopedInventoryIds.has(invId) : false;
            });
          })
        : historyData;
    setHistory(scopedHistory);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => {
      // Buang baris scope lama lebih dahulu supaya tidak sempat tampil
      // selama refetch scope baru berlangsung.
      setHistory([]);
      setStockSnapshot([]);
      setLedgerEntries([]);
      void load();
    }, 0);
    return () => clearTimeout(timer);
    // scopeVersion: refetch saat user berpindah scope site.
  }, [load, scopeVersion]);

  const handleReturn = async () => {
    if (!selectedDispensing) return;
    if (!returnBatchId || !returnQuantity || !returnReason) {
      setActionError("Batch, jumlah, dan alasan wajib diisi.");
      return;
    }
    const qty = Number(returnQuantity);
    if (qty <= 0) {
      setActionError("Jumlah harus lebih dari 0.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      // Cross-site guard: riwayat dispensing sudah di-scope backend
      // ke site pengguna — retur hanya sah untuk site dalam cakupan.
      const siteScope = await resolvePharmacySiteScope();
      const siteContext = siteScope.unrestricted
        ? undefined
        : { siteId: siteScope.siteIds[0], siteName: siteScope.siteNames[0] };

      await pharmacyService.returnMedication(
        selectedDispensing.id,
        returnBatchId,
        qty,
        returnReason,
        siteContext
      );

      // Refetch inventory (tetap site-scoped), lalu hitung selisih stock
      // ledger. Riwayat hanya di-refresh bila route-nya memang tersedia,
      // supaya retur tetap tercatat di ledger walau history 404.
      const activeSiteId = useStore.getState().activeSiteId ?? undefined;
      const newInventory = await pharmacyService.getInventory(activeSiteId);
      const entries = diffStockLedger(stockSnapshot, newInventory, "RETURN");
      setLedgerEntries((prev) => [...entries, ...prev]);
      setStockSnapshot(newInventory);
      if (!historyMissing) {
        const newHistory = await pharmacyService.getDispensingHistory().catch(() => [] as DispensingHistoryItem[]);
        setHistory(newHistory);
      }

      setShowReturnModal(false);
      setReturnBatchId("");
      setReturnQuantity("");
      setReturnReason("");
    } catch (e) {
      setActionError(
        e instanceof CrossSiteActionError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Gagal memproses retur."
      );
    } finally {
      setSaving(false);
    }
  };

  const filtered = history.filter(
    (d) =>
      !search ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.prescription?.encounter?.patient?.full_name
        ?.toLowerCase()
        .includes(search.toLowerCase()) ||
      d.prescription?.items?.some((item) =>
        item.medication?.generic_name?.toLowerCase().includes(search.toLowerCase())
      )
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Retur Obat</h1>
        <p className="text-sm text-slate-500">
          Proses retur obat yang sudah dispensing kembali ke stok inventory
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Cari dispensing / pasien / obat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Fase 3 — Stock Ledger: riwayat perubahan stok (RETURN)
          yang dibuktikan dari selisih snapshot inventory. */}
      {ledgerEntries.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Stock Ledger — Retur
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
                  <span className="text-slate-400">→</span>
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {entry.after}
                  </span>
                  <Badge variant="success">+{entry.delta}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && <ErrorState title="Gagal memuat data" message={error} onRetry={load} />}

      {!loading && !error && historyMissing && (
        <EmptyState
          title="Riwayat dispensing belum tersedia"
          description="GET /pharmacy/dispensing/history belum tersedia di backend (404), jadi daftar retur belum bisa ditampilkan. Inventory di bawah tetap dimuat dari backend."
          icon={ScrollText}
        />
      )}

      {!loading && !error && !historyMissing && filtered.length === 0 && (
        <EmptyState
          title="Belum ada riwayat dispensing"
          description="Belum ada data dispensing pada scope Anda."
          icon={Undo2}
        />
      )}

      {!loading && !error && inventory.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScrollText className="size-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Inventory Saat Ini
            </h2>
          </div>
          <div className="space-y-2">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {item.genericName}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      {item.medicationCode}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">{item.siteName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.currentStock <= item.minimumStock ? "warning" : "success"}>
                    {item.currentStock}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map((d) => {
            const patientName = d.prescription?.encounter?.patient?.full_name ?? "-";
            const medications =
              d.prescription?.items
                ?.map((i) => `${i.medication?.generic_name ?? "?"} (${i.quantity})`)
                .join(", ") ?? "-";
            const hasReturns = (d.medication_returns?.length ?? 0) > 0;
            return (
              <Card key={d.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{patientName}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(d.dispensed_at ?? "")} · {medications}
                    </p>
                    {d.dispensing_items?.map((item) => (
                      <p key={item.id} className="text-xs text-slate-500">
                        Batch: {item.stock_batch?.batch_no ?? item.stock_batch_id} · Qty:{" "}
                        {item.quantity}
                      </p>
                    ))}
                    {hasReturns && (
                      <div className="mt-1">
                        <Badge variant="warning">
                          {d.medication_returns?.length ?? 0} retur
                        </Badge>
                        {d.medication_returns?.map((r) => (
                          <p key={r.id} className="text-xs text-slate-500">
                            Retur: {r.quantity} · {r.reason} · {formatDate(r.returned_at ?? "")}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={d.status === "FINAL" ? "success" : "default"}>
                      {d.status}
                    </Badge>
                    <Can action="pharmacy.dispense">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedDispensing(d);
                          setShowReturnModal(true);
                          setActionError(null);
                          setReturnBatchId("");
                          setReturnQuantity("");
                          setReturnReason("");
                        }}
                      >
                        <Undo2 className="size-3.5" />
                        Retur
                      </Button>
                    </Can>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Retur Obat"
      >
        <div className="space-y-4">
          {selectedDispensing && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <p>
                Pasien:{" "}
                <span className="font-medium">
                  {selectedDispensing.prescription?.encounter?.patient?.full_name ?? "-"}
                </span>
              </p>
              <p>
                Obat:{" "}
                {selectedDispensing.prescription?.items
                  ?.map((i) => `${i.medication?.generic_name ?? "?"} (${i.quantity})`)
                  .join(", ") ?? "-"}
              </p>
            </div>
          )}

          {selectedDispensing?.dispensing_items && selectedDispensing.dispensing_items.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Pilih Batch
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                value={returnBatchId}
                onChange={(e) => setReturnBatchId(e.target.value)}
              >
                <option value="">-- Pilih batch --</option>
                {selectedDispensing.dispensing_items.map((item) => (
                  <option key={item.id} value={item.stock_batch_id ?? ""}>
                    {item.stock_batch?.batch_no ?? item.stock_batch_id} (Qty: {item.quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Jumlah Retur"
            type="number"
            value={returnQuantity}
            onChange={(e) => setReturnQuantity(e.target.value)}
            placeholder="0"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Alasan Retur</label>
            <textarea
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              rows={2}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Contoh: Obat tidak digunakan, kedaluwarsa, dll."
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-warning-50 p-3 text-xs text-warning-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Retur akan mengembalikan stok ke batch yang dipilih dan tercatat di stock movement
              ledger. Pastikan batch dan jumlah benar.
            </p>
          </div>

          {actionError && <p className="text-xs text-danger-600">{actionError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowReturnModal(false)} disabled={saving}>
              Batal
            </Button>
            {/* Hanya apoteker (dispense-medicine) yang boleh memproses retur. */}
            <Can action="pharmacy.dispense">
              <Button onClick={handleReturn} disabled={saving}>
                {saving ? "Memproses..." : "Proses Retur"}
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
