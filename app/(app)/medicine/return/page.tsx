"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toastSuccess, toastError } from "@/lib/use-toast";
import { formatDate } from "@/lib/format";
import {
  pharmacyService,
  type DispensingHistoryItem,
} from "@/lib/services/pharmacy.service";
import { Undo2, Search, AlertTriangle } from "lucide-react";

export default function ReturnMedicinePage() {
  const [history, setHistory] = useState<DispensingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedDispensing, setSelectedDispensing] = useState<DispensingHistoryItem | null>(null);
  const [returnBatchId, setReturnBatchId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pharmacyService.getDispensingHistory();
      setHistory(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat dispensing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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
    const patientName =
      selectedDispensing.prescription?.encounter?.patient?.full_name ?? "-";
    setConfirmReturn({ id: selectedDispensing.id, name: patientName });
  };

  const handleConfirmReturn = async () => {
    if (!confirmReturn || !selectedDispensing) return;
    const qty = Number(returnQuantity);
    setSaving(true);
    setActionError(null);
    try {
      await pharmacyService.returnMedication(
        selectedDispensing.id,
        returnBatchId,
        qty,
        returnReason
      );
      setShowReturnModal(false);
      setConfirmReturn(null);
      setReturnBatchId("");
      setReturnQuantity("");
      setReturnReason("");
      await load();
      toastSuccess("Retur obat berhasil", `Obat untuk ${confirmReturn.name} telah dikembalikan ke stok.`);
    } catch (e) {
      setConfirmReturn(null);
      setActionError(e instanceof Error ? e.message : "Gagal memproses retur.");
      toastError("Gagal memproses retur", e instanceof Error ? e.message : undefined);
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

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && <ErrorState title="Gagal memuat data" message={error} onRetry={load} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="Belum ada riwayat dispensing"
          description="Belum ada data dispensing pada scope Anda."
          icon={Undo2}
        />
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
                        <Badge variant="warning">Sudah ada retur</Badge>
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
                      {!hasReturns && (
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
                      )}
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
              <label
                htmlFor="return-batch"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Pilih Batch
              </label>
              <select
                id="return-batch"
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
            <label htmlFor="return-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Alasan Retur
            </label>
            <textarea
              id="return-reason"
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

          {confirmReturn ? (
            <div className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
              <p>
                Konfirmasi retur obat untuk <span className="font-medium">{confirmReturn.name}</span>?
                Tindakan akan mengembalikan stok dan tidak dapat diubah.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowReturnModal(false)}>
              Batal
            </Button>
            <Button
              onClick={() => (confirmReturn ? handleConfirmReturn() : handleReturn())}
              // Tidak boleh dinonaktifkan hanya karena konfirmasi belum ada:
              // klik pertama justru BERBEDA untuk memunculkan konfirmasi.
              disabled={saving}
              data-testid="return-submit"
            >
              {saving ? "Memproses..." : confirmReturn ? "Konfirmasi Retur" : "Proses Retur"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
