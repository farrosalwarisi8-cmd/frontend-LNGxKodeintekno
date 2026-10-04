"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { WifiOff, Wifi, AlertTriangle, CheckCircle, Clock, RefreshCw, ShieldAlert } from "lucide-react";

interface EmergencyRecord {
  id: string;
  type: "registration" | "visit" | "mcu" | "prescription";
  description: string;
  createdAt: string;
  synced: boolean;
}

const INITIAL_QUEUE: EmergencyRecord[] = [
  { id: "eq1", type: "registration", description: "Registrasi pekerja baru: John Doe", createdAt: "2026-09-20T10:00:00", synced: false },
  { id: "eq2", type: "visit", description: "Kunjungan klinik: Jane Smith - Demam", createdAt: "2026-09-20T10:30:00", synced: false },
  { id: "eq3", type: "prescription", description: "E-resep: Paracetamol 500mg", createdAt: "2026-09-20T11:00:00", synced: true },
];

export default function EmergencyPage() {
  const employees = useStore((s) => s.employees);
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<EmergencyRecord[]>(INITIAL_QUEUE);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ type: EmergencyRecord["type"]; description: string }>({ type: "registration", description: "" });

  const pendingCount = queue.filter((q) => !q.synced).length;

  const handleSubmit = () => {
    const newRecord: EmergencyRecord = {
      id: `eq${Date.now()}`,
      ...formData,
      createdAt: new Date().toISOString(),
      synced: isOnline,
    };
    setQueue((prev) => [newRecord, ...prev]);
    setShowModal(false);
    setFormData({ type: "registration", description: "" });
  };

  const handleSync = () => {
    setQueue((prev) => prev.map((q) => ({ ...q, synced: true })));
    setIsOnline(true);
  };

  const toggleOnline = () => {
    setIsOnline((prev) => !prev);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Emergency Mode</h1>
          <p className="text-sm text-slate-500">Mode darurat offline dengan upgrade queue</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={isOnline ? "outline" : "danger"} onClick={toggleOnline}>
            {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
            {isOnline ? "Online" : "Offline"}
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="size-4" />
            Catatan Darurat
          </Button>
        </div>
      </div>

      {!isOnline && (
        <Card className="border-warning-200 bg-warning-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-warning-600" />
            <div>
              <p className="font-medium text-warning-700">Mode Darurat Aktif</p>
              <p className="text-sm text-warning-600">
                Sistem sedang offline. Semua data akan disimpan di upgrade queue dan disinkronkan otomatis saat koneksi pulih.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{pendingCount}</p>
              <p className="text-xs text-slate-500">Pending Sync</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{queue.filter((q) => q.synced).length}</p>
              <p className="text-xs text-slate-500">Synced</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{queue.length}</p>
              <p className="text-xs text-slate-500">Total Records</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 && (
        <Button onClick={handleSync} className="w-full">
          <RefreshCw className="size-4" />
          Sinkronkan {pendingCount} Record
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upgrade Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {queue.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{record.description}</p>
                  <p className="text-xs text-slate-500">
                    {record.type} · {formatDate(record.createdAt)}
                  </p>
                </div>
                <Badge variant={record.synced ? "success" : "warning"}>
                  {record.synced ? "Synced" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Catatan Darurat</h2>
            <div className="space-y-4">
              <Select
                label="Tipe"
                value={formData.type}
                onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value as EmergencyRecord["type"] }))}
                options={[
                  { value: "registration", label: "Registrasi" },
                  { value: "visit", label: "Kunjungan" },
                  { value: "mcu", label: "MCU" },
                  { value: "prescription", label: "Resep" },
                ]}
              />
              <Input
                label="Deskripsi"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Deskripsi catatan darurat..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
                <Button onClick={handleSubmit}>Simpan</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}
