"use client";

import { Can } from "@/components/can";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { toastSuccess, toastError } from "@/lib/use-toast";
import {
  waiverService,
  type BackendWaiver,
  type WaiverDecision,
} from "@/lib/services/waiver.service";
import { ShieldAlert, Plus, CheckCircle, Clock, XCircle, Send, Ban, Search } from "lucide-react";

const EMPTY_FORM = {
  visitorName: "",
  company: "",
  hostName: "",
  hostEmail: "",
  purpose: "",
  validUntil: "",
  deviation: "",
  medication: "",
  exposureRisk: "",
  healthDeclaration: "",
};

function lifecycleOf(w: BackendWaiver): WaiverDecision | "EXPIRED" {
  if (w.lifecycle) return w.lifecycle;
  if (w.status === "FINAL") return "APPROVED";
  if (w.status === "VOID") return "REJECTED";
  return "PENDING";
}

const BADGE_VARIANT: Record<string, "success" | "danger" | "warning" | "default"> = {
  APPROVED: "success",
  REJECTED: "danger",
  PENDING: "warning",
  EXPIRED: "default",
};

export default function WaiverPage() {
  const [waivers, setWaivers] = useState<BackendWaiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Public verify panel (pengujian alur token oleh HSE)
  const [publicToken, setPublicToken] = useState("");
  const [publicResult, setPublicResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await waiverService.list(1, 50, search || undefined);
      setWaivers(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat waiver dari backend.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleSubmit = async () => {
    setActionError(null);
    if (!formData.visitorName || !formData.purpose || !formData.validUntil) {
      setActionError("Nama visitor, tujuan, dan tanggal berlaku wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await waiverService.create({
        visitorName: formData.visitorName,
        company: formData.company || undefined,
        hostName: formData.hostName || undefined,
        hostEmail: formData.hostEmail || undefined,
        purpose: formData.purpose,
        validUntil: formData.validUntil,
        deviation: formData.deviation || undefined,
        medication: formData.medication || undefined,
        exposureRisk: formData.exposureRisk || undefined,
        healthDeclaration: formData.healthDeclaration || undefined,
      });
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      await load();
      toastSuccess("Waiver disimpan", "Waiver visitor berhasil tercatat di backend.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan waiver.");
      toastError("Gagal menyimpan waiver", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActingId(id);
    setActionError(null);
    try {
      await waiverService.decide(id, status);
      await load();
      toastSuccess(status === "APPROVED" ? "Waiver disetujui" : "Waiver ditolak", "Keputusan waiver telah tersimpan.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memutus waiver.");
      toastError("Gagal memutus waiver", e instanceof Error ? e.message : undefined);
    } finally {
      setActingId(null);
    }
  };

  const handleSend = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      const res = await waiverService.send(id);
      setPublicResult(
        res.devToken
          ? `Token dikirim ke ${res.email}. Token uji (non-production): ${res.devToken}`
          : `Token dikirim ke ${res.email}.`
      );
      setPublicToken(res.devToken ?? "");
      await load();
      toastSuccess("Consent terkirim", "Token consent telah dikirim ke email host.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal mengirim consent.");
      toastError("Gagal mengirim consent", e instanceof Error ? e.message : undefined);
    } finally {
      setActingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await waiverService.revoke(id);
      await load();
      toastSuccess("Token direvoke", "Token consent telah dicabut.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal merevoke token.");
      toastError("Gagal mencabut token", e instanceof Error ? e.message : undefined);
    } finally {
      setActingId(null);
    }
  };

  const handlePublicVerify = async () => {
    setPublicResult(null);
    try {
      const res = await waiverService.publicVerify(publicToken);
      setPublicResult(
        `Token ${res.valid ? "VALID" : "TIDAK VALID"} — ${res.visitorName} (${res.site ?? "-"}), berlaku s/d ${formatDate(res.validUntil)}`
      );
      toastSuccess(res.valid ? "Token valid" : "Token tidak valid", `Token untuk ${res.visitorName} ${res.valid ? "dapat diverifikasi" : "tidak dapat diverifikasi"}.`);
    } catch (e) {
      setPublicResult(e instanceof Error ? e.message : "Verifikasi token gagal.");
      toastError("Verifikasi token gagal", e instanceof Error ? e.message : undefined);
    }
  };

  const handlePublicDecision = async (decision: "APPROVED" | "REJECTED") => {
    setPublicResult(null);
    try {
      const res =
        decision === "APPROVED"
          ? await waiverService.publicApprove(publicToken)
          : await waiverService.publicReject(publicToken);
      setPublicResult(`Public decision tersimpan: ${res.status} / ${res.decision}`);
      await load();
      toastSuccess("Keputusan publik tersimpan", `Keputusan: ${res.status} / ${res.decision}.`);
    } catch (e) {
      setPublicResult(
        e instanceof ApiError && e.status === 409
          ? "Token sudah dipakai dengan keputusan berbeda (409 Conflict)."
          : e instanceof Error
            ? e.message
            : "Public decision gagal."
      );
      toastError("Public decision gagal", e instanceof Error ? e.message : undefined);
    }
  };

  const counts = {
    PENDING: waivers.filter((w) => lifecycleOf(w) === "PENDING").length,
    APPROVED: waivers.filter((w) => lifecycleOf(w) === "APPROVED").length,
    REJECTED: waivers.filter((w) => lifecycleOf(w) === "REJECTED").length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Waiver Visitor</h1>
          <p className="text-sm text-slate-500">
            Kelola waiver untuk visitor tanpa MCU — tersimpan di backend sesuai site scope Anda
          </p>
        </div>
        <Can action="waiver.decide">
          <Button onClick={() => { setActionError(null); setShowModal(true); }}>
            <Plus className="size-4" />
            Buat Waiver
          </Button>
        </Can>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      {/* Ringkasan status */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{counts.PENDING}</p>
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
              <p className="text-xl font-semibold text-slate-900">{counts.APPROVED}</p>
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
              <p className="text-xl font-semibold text-slate-900">{counts.REJECTED}</p>
              <p className="text-xs text-slate-500">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nama visitor / perusahaan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && <ErrorState title="Gagal memuat waiver" message={error} onRetry={load} />}

      {!loading && !error && waivers.length === 0 && (
        <EmptyState
          title="Belum ada waiver"
          description="Belum ada waiver pada scope Anda. Buat waiver baru untuk memulai."
          icon={ShieldAlert}
        />
      )}

      {!loading && !error && (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Visitor</TableHead>
                <TableHead>Perusahaan</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Berlaku s/d</TableHead>
                <TableHead className="text-center w-24">Status</TableHead>
                <TableHead className="text-right w-40">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waivers.map((waiver) => {
                const lifecycle = lifecycleOf(waiver);
                const consent = waiver.waiver_consent;
                const busy = actingId === waiver.id;
                return (
                  <TableRow key={waiver.id}>
                    <TableCell className="whitespace-normal">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{waiver.visitor_name}</p>
                        <p className="text-xs text-slate-500">Tujuan: {waiver.purpose}</p>
                        {waiver.deviation && <p className="text-xs text-slate-500">Deviasi: {waiver.deviation}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="text-sm text-slate-900">{waiver.company ?? "-"}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="text-sm text-slate-900">{waiver.site?.name ?? "Tanpa site"}</p>
                    </TableCell>
                    <TableCell className="text-right whitespace-normal">
                      <p className="text-sm text-slate-900">{formatDate(waiver.valid_until)}</p>
                    </TableCell>
                    <TableCell className="text-center whitespace-normal">
                      <Badge variant={BADGE_VARIANT[lifecycle] ?? "default"}>{lifecycle}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge variant="outline" className="text-xs">
                          {consent ? (consent.revoked_at ? "Direvoke" : "Consent terkirim") : "Belum dikirim"}
                        </Badge>
                        <Can action="waiver.decide">
                          {lifecycle === "PENDING" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleDecision(waiver.id, "REJECTED")}
                              >
                                Tolak
                              </Button>
                              <Button size="sm" disabled={busy} onClick={() => handleDecision(waiver.id, "APPROVED")}>
                                Approve
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => handleSend(waiver.id)}
                          >
                            <Send className="size-3.5" />
                            {consent ? "Kirim ulang" : "Kirim consent"}
                          </Button>
                          {consent && !consent.revoked_at && (
                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleRevoke(waiver.id)}>
                              <Ban className="size-3.5" />
                              Revoke
                            </Button>
                          )}
                        </Can>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Panel aksi publik (uji alur token) */}
      <Card className="p-4">
        <p className="text-sm font-medium text-slate-900">Uji alur publik (verify / approve / reject)</p>
        <p className="text-xs text-slate-500">
          Alur yang sama dengan halaman publik visitor. Token hanya berisi data minimal (tanpa data klinis).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Token consent"
            value={publicToken}
            onChange={(e) => setPublicToken(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePublicVerify} disabled={!publicToken}>
              Verify
            </Button>
            <Button onClick={() => handlePublicDecision("APPROVED")} disabled={!publicToken}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => handlePublicDecision("REJECTED")} disabled={!publicToken}>
              Reject
            </Button>
          </div>
        </div>
        {publicResult && <p className="mt-2 text-xs text-slate-600">{publicResult}</p>}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Buat Waiver Visitor" size="lg">
        <div className="space-y-4">
          <Input
            label="Nama Visitor"
            value={formData.visitorName}
            onChange={(e) => setFormData((f) => ({ ...f, visitorName: e.target.value }))}
          />
          <Input
            label="Perusahaan"
            value={formData.company}
            onChange={(e) => setFormData((f) => ({ ...f, company: e.target.value }))}
          />
          <Input
            label="Host / Penanggung Jawab"
            value={formData.hostName}
            onChange={(e) => setFormData((f) => ({ ...f, hostName: e.target.value }))}
          />
          <Input
            label="Email Host (untuk consent)"
            value={formData.hostEmail}
            onChange={(e) => setFormData((f) => ({ ...f, hostEmail: e.target.value }))}
          />
          <Input
            label="Tujuan Kunjungan"
            value={formData.purpose}
            onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))}
          />
          <Input
            label="Berlaku Sampai"
            type="date"
            value={formData.validUntil}
            onChange={(e) => setFormData((f) => ({ ...f, validUntil: e.target.value }))}
          />
          <Input
            label="Deviasi"
            value={formData.deviation}
            onChange={(e) => setFormData((f) => ({ ...f, deviation: e.target.value }))}
          />
          <Input
            label="Obat yang Dibawa"
            value={formData.medication}
            onChange={(e) => setFormData((f) => ({ ...f, medication: e.target.value }))}
          />
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
          {actionError && <p className="text-xs text-danger-600">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Can action="waiver.decide">
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
