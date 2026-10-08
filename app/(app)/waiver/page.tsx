"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { ShieldAlert, Plus, CheckCircle, Clock, XCircle } from "lucide-react";

interface Waiver {
  id: string;
  visitorName: string;
  company: string;
  purpose: string;
  deviation: string;
  medication: string;
  exposureRisk: string;
  healthDeclaration: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

const WAIVERS: Waiver[] = [
  {
    id: "w1",
    visitorName: "John Smith",
    company: "PT Contractor",
    purpose: "Maintenance peralatan",
    deviation: "Tidak ada MCU",
    medication: "Tidak ada",
    exposureRisk: "Rendah",
    healthDeclaration: "Sehat",
    status: "PENDING",
    createdAt: "2026-09-20",
  },
  {
    id: "w2",
    visitorName: "Ahmad Lee",
    company: "PT Supplier",
    purpose: "Delivery barang",
    deviation: "Tidak ada MCU",
    medication: "Tidak ada",
    exposureRisk: "Rendah",
    healthDeclaration: "Sehat",
    status: "APPROVED",
    createdAt: "2026-09-18",
  },
];

export default function WaiverPage() {
  const [waivers, setWaivers] = useState<Waiver[]>(WAIVERS);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    visitorName: "",
    company: "",
    purpose: "",
    deviation: "",
    medication: "",
    exposureRisk: "",
    healthDeclaration: "",
  });

  const handleSubmit = () => {
    const newWaiver: Waiver = {
      id: `w${Date.now()}`,
      ...formData,
      status: "PENDING",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setWaivers((prev) => [newWaiver, ...prev]);
    setShowModal(false);
    setFormData({ visitorName: "", company: "", purpose: "", deviation: "", medication: "", exposureRisk: "", healthDeclaration: "" });
  };

  const handleDecision = (id: string, status: "APPROVED" | "REJECTED") => {
    setWaivers((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Waiver Visitor</h1>
          <p className="text-sm text-slate-500">Kelola waiver untuk visitor tanpa MCU</p>
        </div>
        <Can action="waiver.decide">
          <Button onClick={() => setShowModal(true)}>
            <Plus className="size-4" />
            Buat Waiver
          </Button>
        </Can>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{waivers.filter((w) => w.status === "PENDING").length}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{waivers.filter((w) => w.status === "APPROVED").length}</p>
              <p className="text-xs text-slate-500">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{waivers.filter((w) => w.status === "REJECTED").length}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {waivers.map((waiver) => (
          <Card key={waiver.id} className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{waiver.visitorName}</p>
                <p className="text-xs text-slate-500">{waiver.company} · {formatDate(waiver.createdAt)}</p>
                <p className="text-xs text-slate-500">Tujuan: {waiver.purpose}</p>
                <p className="text-xs text-slate-500">Deviasi: {waiver.deviation}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={waiver.status === "APPROVED" ? "success" : waiver.status === "REJECTED" ? "danger" : "warning"}>
                  {waiver.status}
                </Badge>
                {waiver.status === "PENDING" && (
                  <Can action="waiver.decide">
                    <Button size="sm" variant="outline" onClick={() => handleDecision(waiver.id, "REJECTED")}>Tolak</Button>
                    <Button size="sm" onClick={() => handleDecision(waiver.id, "APPROVED")}>Approve</Button>
                  </Can>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Buat Waiver Visitor"
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Nama Visitor" value={formData.visitorName} onChange={(e) => setFormData((f) => ({ ...f, visitorName: e.target.value }))} />
          <Input label="Perusahaan" value={formData.company} onChange={(e) => setFormData((f) => ({ ...f, company: e.target.value }))} />
          <Input label="Tujuan Kunjungan" value={formData.purpose} onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))} />
          <Input label="Deviasi" value={formData.deviation} onChange={(e) => setFormData((f) => ({ ...f, deviation: e.target.value }))} />
          <Input label="Obat yang Dibawa" value={formData.medication} onChange={(e) => setFormData((f) => ({ ...f, medication: e.target.value }))} />
          <Select
            label="Exposure Risk"
            value={formData.exposureRisk}
            onChange={(e) => setFormData((f) => ({ ...f, exposureRisk: e.target.value }))}
            placeholder="Pilih risiko"
            options={[
              { value: "Rendah", label: "Rendah" },
              { value: "Sedang", label: "Sedang" },
              { value: "Tinggi", label: "Tinggi" },
            ]}
          />
          <Select
            label="Health Declaration"
            value={formData.healthDeclaration}
            onChange={(e) => setFormData((f) => ({ ...f, healthDeclaration: e.target.value }))}
            placeholder="Pilih deklarasi"
            options={[
              { value: "Sehat", label: "Sehat" },
              { value: "Kurang Sehat", label: "Kurang Sehat" },
              { value: "Sakit", label: "Sakit" },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
            <Can action="waiver.decide">
              <Button onClick={handleSubmit}>Simpan</Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
