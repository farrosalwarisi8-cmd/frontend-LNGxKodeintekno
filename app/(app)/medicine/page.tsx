"use client";

import { Can } from "@/components/can";

import { useState } from "react";

import { useStore } from "@/lib/store";
import { syncInventory, useSyncedModules } from "@/lib/remote-sync";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Plus, Pill, AlertTriangle, ChevronRight } from "lucide-react";

export default function MedicinePage() {
  const medicines = useStore((s) => s.medicines);
  const stockBatches = useStore((s) => s.stockBatches);
  const locations = useStore((s) => s.locations);
  const receiveStock = useStore((s) => s.receiveStock);

  // Modul 5 — sinkron inventaris FEFO dari backend (GET /pharmacy/inventory)
  const { loading, error, refetch } = useSyncedModules(() => syncInventory());

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveData, setReceiveData] = useState({ medicineId: "", locationId: "", batchNumber: "", quantity: "", expiresAt: "" });

  const categories = [...new Set(medicines.map((m) => m.category))];

  const filtered = medicines.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
    const matchCategory = !categoryFilter || m.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const getStockForMedicine = (medicineId: string) => {
    return stockBatches.filter((b) => b.medicineId === medicineId);
  };

  const getTotalStock = (medicineId: string) => {
    return stockBatches.filter((b) => b.medicineId === medicineId).reduce((sum, b) => sum + b.quantity, 0);
  };

  const handleReceive = () => {
    if (!receiveData.medicineId || !receiveData.locationId || !receiveData.batchNumber || !receiveData.quantity) return;
    receiveStock({
      medicineId: receiveData.medicineId,
      locationId: receiveData.locationId,
      batchNumber: receiveData.batchNumber,
      quantity: parseInt(receiveData.quantity),
      expiresAt: receiveData.expiresAt,
    });
    setShowReceiveModal(false);
    setReceiveData({ medicineId: "", locationId: "", batchNumber: "", quantity: "", expiresAt: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Farmasi</h1>
          <p className="text-sm text-slate-500">Stok obat dan batch management</p>
        </div>
        <Can action="pharmacy.receive-stock">
          <Button onClick={() => setShowReceiveModal(true)}>
            <Plus className="size-4" />
            Terima Stok
          </Button>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari obat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Kategori"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={categories.map((c) => ({ value: c, label: c }))}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} obat ditemukan</p>

      {error && <ErrorState title="Gagal memuat inventaris" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState icon={Pill} title="Tidak ada obat ditemukan" description="Coba ubah kata kunci pencarian." />
      ) : !loading && !error ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Obat</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Kode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Kategori</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Total Stok</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Batch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((med) => {
                  const totalStock = getTotalStock(med.id);
                  const batches = getStockForMedicine(med.id);
                  const isLow = totalStock < med.minStock;
                  return (
                    <tr key={med.id} className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{med.name}</div>
                        <div className="text-xs text-slate-500">{med.unit}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{med.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{med.category}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{totalStock}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{batches.length} batch</td>
                      <td className="px-4 py-3">
                        {isLow ? (
                          <Badge variant="danger">
                            <AlertTriangle className="size-3" />
                            Stok Rendah
                          </Badge>
                        ) : (
                          <Badge variant="success">Aman</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="size-4 text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filtered.map((med) => {
              const totalStock = getTotalStock(med.id);
              const isLow = totalStock < med.minStock;
              return (
                <Card key={med.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">{med.name}</div>
                      <div className="text-xs text-slate-500">{med.code} · {med.category}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={isLow ? "danger" : "success"}>
                          {isLow ? "Stok Rendah" : "Aman"}
                        </Badge>
                        <span className="text-xs text-slate-500">Total: {totalStock} {med.unit}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-slate-400" />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Terima Stok Obat</h2>
            <div className="space-y-4">
              <Select
                label="Obat"
                value={receiveData.medicineId}
                onChange={(e) => setReceiveData((d) => ({ ...d, medicineId: e.target.value }))}
                placeholder="Pilih obat"
                options={medicines.map((m) => ({ value: m.id, label: m.name }))}
              />
              <Select
                label="Lokasi"
                value={receiveData.locationId}
                onChange={(e) => setReceiveData((d) => ({ ...d, locationId: e.target.value }))}
                placeholder="Pilih lokasi"
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
              />
              <Input
                label="Nomor Batch"
                value={receiveData.batchNumber}
                onChange={(e) => setReceiveData((d) => ({ ...d, batchNumber: e.target.value }))}
                placeholder="BN-202601-A"
              />
              <Input
                label="Jumlah"
                type="number"
                value={receiveData.quantity}
                onChange={(e) => setReceiveData((d) => ({ ...d, quantity: e.target.value }))}
                placeholder="100"
              />
              <Input
                label="Kedaluwarsa"
                type="date"
                value={receiveData.expiresAt}
                onChange={(e) => setReceiveData((d) => ({ ...d, expiresAt: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowReceiveModal(false)}>Batal</Button>
                <Can action="pharmacy.receive-stock">
                  <Button onClick={handleReceive}>Terima</Button>
                </Can>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
