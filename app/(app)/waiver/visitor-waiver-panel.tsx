"use client";

/**
 * Panel Visitor Waiver Offshore — mengonsumsi endpoint
 * `POST/GET /mcu/visitor-waivers` + `POST .../:id/decision` yang sebelumnya
 * belum dipakai frontend (hanya `/waivers` yang tersambung).
 *
 * Perbedaan kontrak penting dari `/waivers`:
 *   - email visitor WAJIB (bukan hostEmail),
 *   - masa berlaku memakai `validDays` (bukan `validUntil`),
 *   - keputusan memakai enum `APPROVE | REJECT` (bukan APPROVED | REJECTED).
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  visitorWaiverService,
  type BackendVisitorWaiver,
} from "@/lib/services/visitor-waiver.service";
import { Ship, CheckCircle, Clock, XCircle, Plus, Search } from "lucide-react";

const EMPTY_FORM = {
  visitorName: "",
  email: "",
  company: "",
  purpose: "",
  deviation: "",
  medication: "",
  exposureRisk: "",
  healthDeclaration: "",
  validDays: "14",
};

/**
 * Status backend (`RecordStatus`): DRAFT -> FINAL (disetujui) / VOID (ditolak)
 * / EXPIRED. Nilai APPROVED/REJECTED/PENDING juga dipetakan agar aman bila
 * backend mengubah enum di kemudian hari.
 */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Menunggu",
  PENDING: "Menunggu",
  FINAL: "Disetujui",
  APPROVED: "Disetujui",
  APPROVE: "Disetujui",
  VOID: "Ditolak",
  REJECTED: "Ditolak",
  REJECT: "Ditolak",
  EXPIRED: "Kedaluwarsa",
};

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default"> = {
  DRAFT: "warning",
  PENDING: "warning",
  FINAL: "success",
  APPROVED: "success",
  APPROVE: "success",
  VOID: "danger",
  REJECTED: "danger",
  REJECT: "danger",
  EXPIRED: "default",
};

const PENDING_STATUSES = new Set(["DRAFT", "PENDING"]);
const APPROVED_STATUSES = new Set(["FINAL", "APPROVED", "APPROVE"]);
const REJECTED_STATUSES = new Set(["VOID", "REJECTED", "REJECT"]);

export default function VisitorWaiverPanel() {
  const [rows, setRows] = useState<BackendVisitorWaiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await visitorWaiverService.list({
        page: 1,
        limit: 50,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat waiver pengunjung.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleSubmit = async () => {
    setActionError(null);
    if (!formData.visitorName.trim() || !formData.email.trim() || !formData.purpose.trim()) {
      setActionError("Nama pengunjung, email, dan tujuan wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const days = Number(formData.validDays);
      await visitorWaiverService.create({
        visitorName: formData.visitorName.trim(),
        email: formData.email.trim(),
        purpose: formData.purpose.trim(),
        company: formData.company.trim() || undefined,
        deviation: formData.deviation.trim() || undefined,
        medication: formData.medication.trim() || undefined,
        exposureRisk: formData.exposureRisk.trim() || undefined,
        healthDeclaration: formData.healthDeclaration.trim() || undefined,
        validDays: Number.isFinite(days) && days > 0 ? days : 14,
      });
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan waiver pengunjung.");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (id: string, decision: "APPROVE" | "REJECT") => {
    setActingId(id);
    setActionError(null);
    try {
      await visitorWaiverService.decide(id, decision);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memutus waiver pengunjung.");
    } finally {
      setActingId(null);
    }
  };

  const pending = rows.filter((r) => PENDING_STATUSES.has(r.status ?? "")).length;
  const approved = rows.filter((r) => APPROVED_STATUSES.has(r.status ?? "")).length;
  const rejected = rows.filter((r) => REJECTED_STATUSES.has(r.status ?? "")).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Waiver Pengunjung Offshore</h2>
        <p className="text-sm text-muted-foreground">
          Waiver pengunjung offshore (`/mcu/visitor-waivers`) — masa berlaku dalam hari,
          keputusan oleh dokter OH / HSE manager
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{approved}</p>
              <p className="text-xs text-muted-foreground">Disetujui</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{rejected}</p>
              <p className="text-xs text-muted-foreground">Ditolak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama pengunjung / perusahaan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Semua status"
            options={[
              { value: "", label: "Semua Status" },
              { value: "DRAFT", label: "Menunggu" },
              { value: "FINAL", label: "Disetujui" },
              { value: "VOID", label: "Ditolak" },
            ]}
          />
        </div>
        <Can action="waiver.decide">
          <Button
            onClick={() => {
              setActionError(null);
              setShowModal(true);
            }}
          >
            <Plus className="size-4" />
            Buat Waiver Pengunjung
          </Button>
        </Can>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && (
        <ErrorState
          title="Gagal memuat waiver pengunjung"
          message={error}
          onRetry={load}
        />
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Belum ada waiver pengunjung"
          description="Belum ada waiver pengunjung offshore pada scope Anda."
          icon={Ship}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((row) => {
            const status = row.status ?? "DRAFT";
            const busy = actingId === row.id;
            const isPending = PENDING_STATUSES.has(status);
            return (
              <Card key={row.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{row.visitor_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.company || "Perusahaan tidak diisi"} · {row.email}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      Berlaku sampai {formatDate(row.valid_until ?? "")}
                      {row.consent?.used_at
                        ? ` · dikonfirmasi ${formatDate(row.consent.used_at)}`
                        : " · belum dikonfirmasi pengunjung"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Badge variant={STATUS_VARIANT[status] ?? "default"}>
                      {STATUS_LABEL[status] ?? status}
                    </Badge>
                    {isPending && (
                      <div className="flex gap-2">
                        <Can action="waiver.decide">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleDecision(row.id, "APPROVE")}
                          >
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleDecision(row.id, "REJECT")}
                          >
                            Tolak
                          </Button>
                        </Can>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          title="Waiver Pengunjung Offshore"
        >
          <div className="space-y-3">
            <Input
              label="Nama Pengunjung"
              value={formData.visitorName}
              onChange={(e) => setFormData((f) => ({ ...f, visitorName: e.target.value }))}
              placeholder="John Smith"
            />
            <Input
              label="Email Pengunjung"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              placeholder="john@contractor.com"
            />
            <Input
              label="Perusahaan"
              value={formData.company}
              onChange={(e) => setFormData((f) => ({ ...f, company: e.target.value }))}
              placeholder="PT Contractor"
            />
            <Input
              label="Tujuan"
              value={formData.purpose}
              onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))}
              placeholder="Inspeksi turbin"
            />
            <Input
              label="Masa Berlaku (hari)"
              type="number"
              value={formData.validDays}
              onChange={(e) => setFormData((f) => ({ ...f, validDays: e.target.value }))}
            />
            <Input
              label="Deviasi"
              value={formData.deviation}
              onChange={(e) => setFormData((f) => ({ ...f, deviation: e.target.value }))}
              placeholder="Tidak ada MCU tahunan"
            />
            <Input
              label="Obat yang Dikonsumsi"
              value={formData.medication}
              onChange={(e) => setFormData((f) => ({ ...f, medication: e.target.value }))}
            />
            <Input
              label="Risiko Paparan"
              value={formData.exposureRisk}
              onChange={(e) => setFormData((f) => ({ ...f, exposureRisk: e.target.value }))}
            />
            <Input
              label="Deklarasi Kesehatan"
              value={formData.healthDeclaration}
              onChange={(e) => setFormData((f) => ({ ...f, healthDeclaration: e.target.value }))}
            />
            {actionError && <p className="text-xs text-danger-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
