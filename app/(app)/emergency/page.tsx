"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
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

const DEVICE_FP_KEY = "kodein_emergency_device_fp";

function deviceFingerprint(): string {
  let fp = "";
  try {
    fp = localStorage.getItem(DEVICE_FP_KEY) ?? "";
  } catch {
    /* storage tidak tersedia */
  }
  if (!fp) {
    fp = `edge-${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
    try {
      localStorage.setItem(DEVICE_FP_KEY, fp);
    } catch {
      /* ignore */
    }
  }
  // Backend menyimpan hash fingerprint perangkat
  let hash = 0x811c9dc5;
  for (let i = 0; i < fp.length; i++) {
    hash ^= fp.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fp-${(hash >>> 0).toString(16)}-${fp.length}`;
}

export default function EmergencyPage() {
  const employees = useStore((s) => s.employees);
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<EmergencyRecord[]>(INITIAL_QUEUE);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ type: EmergencyRecord["type"]; description: string }>({ type: "registration", description: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const pendingCount = queue.filter((q) => !q.synced).length;

  const handleSubmit = () => {
    const newRecord: EmergencyRecord = {
      id: `eq${Date.now()}`,
      ...formData,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    setQueue((prev) => [newRecord, ...prev]);
    setShowModal(false);
    setFormData({ type: "registration", description: "" });
  };

  /**
   * Sinkronisasi NYATA ke backend (Domain 11):
   *  1. POST /api/v1/sync/register-device (idempotent per fingerprint)
   *  2. POST /api/v1/sync/push (idempotency key = deviceId + localRecordId)
   * Jika backend gagal, antrian tetap pending — tidak ada fake success.
   */
  const handleSync = async () => {
    const pending = queue.filter((q) => !q.synced);
    if (pending.length === 0) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const device = await apiClient.post<{ id: string }>("/sync/register-device", {
        deviceFingerprintHash: deviceFingerprint(),
        siteCode: "SITE-HO-JKT",
      });
      const result = await apiClient.post<{
        results: Array<{ localRecordId: string; status: string; message: string }>;
      }>("/sync/push", {
        deviceId: device.id,
        items: pending.map((q) => ({
          localRecordId: q.id,
          entityType: "EMERGENCY_NOTE",
          payload: { type: q.type, description: q.description, createdAt: q.createdAt },
        })),
      });

      const statusById = new Map(result.results.map((r) => [r.localRecordId, r.status]));
      setQueue((prev) =>
        prev.map((q) =>
          !q.synced && statusById.get(q.id) === "SYNCED" ? { ...q, synced: true } : q
        )
      );
      const syncedCount = result.results.filter((r) => r.status === "SYNCED").length;
      const skipped = result.results.filter((r) => r.status === "IDEMPOTENT_SKIPPED").length;
      const conflicts = result.results.filter((r) => r.status === "CONFLICT").length;
      setSyncMessage({
        type: "ok",
        text: `Sinkronisasi backend: ${syncedCount} synced${skipped ? `, ${skipped} sudah pernah terkirim (idempoten)` : ""}${conflicts ? `, ${conflicts} konflik perlu resolusi manual` : ""}.`,
      });
      setIsOnline(true);
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Sinkronisasi ke backend gagal. Antrian tetap pending.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const toggleOnline = () => {
    setIsOnline((prev) => !prev);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Emergency Mode</h1>
          <p className="text-sm text-muted-foreground">Mode darurat offline dengan upgrade queue</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={isOnline ? "outline" : "danger"} onClick={toggleOnline}>
            {isOnline ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
            {isOnline ? "Online" : "Offline"}
          </Button>
          <Can action="emergency.create">
            <Button onClick={() => setShowModal(true)}>
              <Plus className="size-4" />
              Catatan Darurat
            </Button>
          </Can>
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
              <p className="text-xl font-semibold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Sync</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{queue.filter((q) => q.synced).length}</p>
              <p className="text-xs text-muted-foreground">Synced</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{queue.length}</p>
              <p className="text-xs text-muted-foreground">Total Records</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {syncMessage && (
        <div
          className={`rounded-xl p-3 text-sm ${
            syncMessage.type === "ok" ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"
          }`}
        >
          {syncMessage.text}
        </div>
      )}

      {pendingCount > 0 && (
        <Button onClick={handleSync} loading={syncing} disabled={syncing} className="w-full">
          <RefreshCw className="size-4" />
          Sinkronkan {pendingCount} Record ke Backend
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upgrade Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {queue.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{record.description}</p>
                  <p className="text-xs text-muted-foreground">
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

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Catatan Darurat"
        size="sm"
      >
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
            <Can action="emergency.create">
              <Button onClick={handleSubmit}>Simpan</Button>
            </Can>
          </div>
        </div>
      </Modal>
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
