"use client";

import { Can } from "@/components/can";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { syncInventory, useSyncedModules } from "@/lib/remote-sync";
import { resolveScope } from "@/lib/services/reference.service";
import { pharmacyService, type BackendPrescriptionItem } from "@/lib/services/pharmacy.service";
import { Pill, Search, CheckCircle, AlertTriangle } from "lucide-react";

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

  const load = async () => {
    const rows = await pharmacyService.getPendingPrescriptions();
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
  };

  const { loading, error, refetch } = useSyncedModules(load);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prescriptions.filter(
      (p) => !q || p.visitNumber.toLowerCase().includes(q) || p.patientName.toLowerCase().includes(q)
    );
  }, [prescriptions, search]);

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
   */
  const handleDispense = async () => {
    if (!selectedRx) return;
    setBusy(true);
    setMessage(null);
    try {
      const scope = await resolveScope();
      const byBatch = new Map<string, number>();

      for (const item of selectedRx.items) {
        const medicationId = item.medication_id;
        if (!medicationId) continue;
        const qty = quantities[item.id] ?? item.quantity ?? 0;
        if (qty <= 0) continue;

        const rec = await pharmacyService.recommendBatches(
          medicationId,
          scope.siteId,
          qty
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

      await pharmacyService.dispense(selectedRx.id, allocations);

      setMessage({ type: "ok", text: "Dispensing berhasil diproses oleh backend." });
      setPrescriptions((prev) => prev.filter((p) => p.id !== selectedRx.id));
      setTimeout(() => {
        setShowModal(false);
        refetch();
      }, 900);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Dispensing gagal.",
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

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
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
                  <Badge variant="warning">Menunggu</Badge>
                  <Can action="pharmacy.dispense">
                    <Button size="sm" onClick={() => openDispense(rx)}>
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
              <Button onClick={handleDispense} loading={busy} disabled={busy}>
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
