"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import { toastSuccess, toastError } from "@/lib/use-toast";
import { Plus, Wifi, WifiOff, AlertTriangle, CheckCircle, Clock, RefreshCw, ShieldAlert } from "lucide-react";

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

const TYPE_LABEL: Record<EmergencyRecord["type"], string> = {
  registration: "Registrasi",
  visit: "Kunjungan",
  mcu: "MCU",
  prescription: "Resep",
};

export default function EmergencyPage() {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<EmergencyRecord[]>(INITIAL_QUEUE);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{ type: EmergencyRecord["type"]; description: string }>({ type: "registration", description: "" });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "synced" | "pending">("all");

  const pendingCount = queue.filter((q) => !q.synced).length;

  const filteredQueue = queue.filter((q) => {
    if (statusFilter === "synced") return q.synced;
    if (statusFilter === "pending") return !q.synced;
    return true;
  });

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
    toastSuccess("Catatan darurat disimpan", "Catatan telah ditambahkan ke antrean darurat.");
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
      toastSuccess("Sinkronisasi selesai", `${syncedCount} record tersinkronisasi ke backend.`);
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Sinkronisasi ke backend gagal. Antrian tetap pending.",
      });
      toastError("Sinkronisasi gagal", e instanceof Error ? e.message : undefined);
    } finally {
      setSyncing(false);
    }
  };

  const toggleOnline = () => {
    setIsOnline((prev) => !prev);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Emergency Mode</h1>
          <p className="text-sm text-slate-500">
            Mode darurat offline dengan antrean sinkronisasi ke backend
          </p>
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
                Sistem sedang offline. Semua data akan disimpan di antrean dan disinkronkan otomatis saat koneksi pulih.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Ringkasan status */}
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

      {/* Filter bar */}
      <Card className="p-4">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "synced" | "pending")}
          placeholder="Filter status sinkronisasi"
          options={[
            { value: "all", label: "Semua" },
            { value: "synced", label: "Tersinkronisasi" },
            { value: "pending", label: "Belum Tersinkron" },
          ]}
        />
      </Card>

      {syncMessage && (
        <div
          className={`rounded-xl p-3 text-sm ${syncMessage.type === "ok" ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"}`}
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

      {/* Tabel daftar antrean */}
      <Card>
        <CardHeader>
          <CardTitle>Upgrade Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredQueue.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Tidak ada catatan antrean.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-center w-32">Tipe</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead className="text-center w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-normal">{record.description}</TableCell>
                    <TableCell className="text-center whitespace-normal">{TYPE_LABEL[record.type]}</TableCell>
                    <TableCell className="whitespace-normal">{formatDate(record.createdAt)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={record.synced ? "success" : "warning"}>
                        {record.synced ? "Synced" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Catatan Darurat" size="md">
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
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Can action="emergency.create">
              <Button onClick={handleSubmit}>Simpan</Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
