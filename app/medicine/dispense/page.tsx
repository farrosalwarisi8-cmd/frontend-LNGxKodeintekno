"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { Pill, Search, CheckCircle, AlertTriangle } from "lucide-react";

export default function DispensePage() {
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const medicines = useStore((s) => s.medicines);
  const stockBatches = useStore((s) => s.stockBatches);
  const dispense = useStore((s) => s.dispense);

  const [search, setSearch] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [dispenseItems, setDispenseItems] = useState<{ medicineId: string; batchId: string; quantity: number }[]>([]);
  const [currentMedicine, setCurrentMedicine] = useState("");
  const [currentBatch, setCurrentBatch] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState("");

  const pendingVisits = visits.filter((v) => v.status === "Awaiting Pharmacy" || v.status === "In Consultation");

  const filtered = pendingVisits.filter((v) => {
    const emp = employees.find((e) => e.id === v.employeeId);
    const q = search.toLowerCase();
    return !q || v.visitNumber.toLowerCase().includes(q) || emp?.fullName.toLowerCase().includes(q);
  });

  const visit = visits.find((v) => v.id === selectedVisit);
  const visitEmployee = visit ? employees.find((e) => e.id === visit.employeeId) : null;

  const openDispense = (visitId: string) => {
    setSelectedVisit(visitId);
    setDispenseItems([]);
    setShowModal(true);
  };

  const addItem = () => {
    if (!currentMedicine || !currentBatch || !currentQuantity) return;
    setDispenseItems((prev) => [...prev, { medicineId: currentMedicine, batchId: currentBatch, quantity: parseInt(currentQuantity) }]);
    setCurrentMedicine("");
    setCurrentBatch("");
    setCurrentQuantity("");
  };

  const removeItem = (index: number) => {
    setDispenseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDispense = () => {
    if (!selectedVisit || dispenseItems.length === 0) return;
    const result = dispense(selectedVisit, dispenseItems);
    if (result.ok) {
      setShowModal(false);
    }
  };

  const getFEFOBatches = (medicineId: string) => {
    return stockBatches
      .filter((b) => b.medicineId === medicineId && b.quantity > 0)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dispensing Obat</h1>
        <p className="text-sm text-slate-500">FEFO dispensing untuk kunjunggan selesai konsultasi</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari kunjungan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} kunjunggan menunggu dispensing</p>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto mb-3 size-8 text-success-600" />
          <p className="text-sm text-slate-500">Tidak ada kunjunggan yang menunggu dispensing.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => {
            const emp = employees.find((e) => e.id === v.employeeId);
            return (
              <Card key={v.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp?.fullName ?? "?"} />
                    <div>
                      <p className="font-medium text-slate-900">{emp?.fullName}</p>
                      <p className="text-xs text-slate-500">
                        {v.visitNumber} · {formatDate(v.date)}
                      </p>
                      <p className="text-xs text-slate-500">Keluhan: {v.chiefComplaint}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">{v.status}</Badge>
                    <Button size="sm" onClick={() => openDispense(v.id)}>
                      <Pill className="size-3.5" />
                      Dispense
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Dispensing Obat (FEFO)"
        description={visit ? `${visit.visitNumber} — ${visitEmployee?.fullName}` : ""}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              label="Obat"
              value={currentMedicine}
              onChange={(e) => {
                setCurrentMedicine(e.target.value);
                setCurrentBatch("");
              }}
              placeholder="Pilih obat"
              options={medicines.map((m) => ({ value: m.id, label: m.name }))}
            />
            <Select
              label="Batch (FEFO)"
              value={currentBatch}
              onChange={(e) => setCurrentBatch(e.target.value)}
              placeholder="Pilih batch"
              options={getFEFOBatches(currentMedicine).map((b) => ({
                value: b.id,
                label: `${b.batchNumber} (Exp: ${formatDate(b.expiresAt)}, Stok: ${b.quantity})`,
              }))}
            />
            <Input
              label="Jumlah"
              type="number"
              value={currentQuantity}
              onChange={(e) => setCurrentQuantity(e.target.value)}
              placeholder="10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={addItem} disabled={!currentMedicine || !currentBatch || !currentQuantity}>
            Tambah Item
          </Button>

          {dispenseItems.length > 0 && (
            <div className="space-y-2">
              {dispenseItems.map((item, index) => {
                const med = medicines.find((m) => m.id === item.medicineId);
                const batch = stockBatches.find((b) => b.id === item.batchId);
                return (
                  <div key={index} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{med?.name}</p>
                      <p className="text-xs text-slate-500">
                        {batch?.batchNumber} · {item.quantity} {med?.unit}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>Hapus</Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
            <Button onClick={handleDispense} disabled={dispenseItems.length === 0}>
              <CheckCircle className="size-4" />
              Proses Dispensing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
