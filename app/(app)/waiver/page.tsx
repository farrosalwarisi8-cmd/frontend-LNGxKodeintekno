"use client";

import { Can } from "@/components/can";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
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
import { ApiError } from "@/lib/api-client";
import {
  waiverService,
  filterWaiversBySite,
  type BackendWaiver,
  type WaiverDecision,
} from "@/lib/services/waiver.service";
import { masterDataService } from "@/lib/services/master-data.service";
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

  // Fase 4 — scope site aktif: daftar waiver di-refetch saat scope berubah
  // dan baris dari scope lain disaring keluar (data lama tidak tampil).
  const activeSiteId = useStore((s) => s.activeSiteId);
  const scopeVersion = useStore((s) => s.scopeVersion);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Public verify panel (pengujian alur token oleh HSE)
  const [publicToken, setPublicToken] = useState("");
  const [publicResult, setPublicResult] = useState<string | null>(null);

  // Fase 4 — kirim consent: backend mewajibkan email penerima (hostEmail atau
  // body.email). Bila waiver tidak punya host_email, UI memungkinkan input
  // email sebelum mengirim (sebelumnya langsung 400 tanpa jalan keluar).
  const [sendTarget, setSendTarget] = useState<BackendWaiver | null>(null);
  const [sendEmail, setSendEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await waiverService.list(1, 50, search || undefined);
      // Fase 4 — GET /waivers di-scope backend per token; untuk user GLOBAL
      // yang memilih scope site tertentu, baris luar scope dibuang di client.
      setWaivers(filterWaiversBySite(res.data, activeSiteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat waiver dari backend.");
    } finally {
      setLoading(false);
    }
  }, [search, activeSiteId]);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // scopeVersion: refetch saat user berpindah scope site.
  }, [load, scopeVersion]);

  const handleSubmit = async () => {
    setActionError(null);
    if (!formData.visitorName || !formData.purpose || !formData.validUntil) {
      setActionError("Nama visitor, tujuan, dan tanggal berlaku wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      // Fase 4 — waiver yang dibuat saat scope site aktif harus ikut site itu,
      // andai tidak, backend menyimpan site_id=null dan waiver langsung hilang
      // dari daftar (disaring keluar oleh scope aktif).
      const { activeSiteId } = useStore.getState();
      let siteCode: string | undefined;
      if (activeSiteId) {
        const sites = await masterDataService.listSites({ active: true });
        siteCode = sites.find((s) => s.id === activeSiteId)?.code;
      }
      await waiverService.create({
        siteCode,
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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan waiver.");
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
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memutus waiver.");
    } finally {
      setActingId(null);
    }
  };

  const handleSend = async (id: string, email?: string) => {
    setActingId(id);
    setActionError(null);
    try {
      const res = await waiverService.send(id, email || undefined);
      setPublicResult(
        res.devToken
          ? `Token dikirim ke ${res.email}. Token uji (non-production): ${res.devToken}`
          : `Token dikirim ke ${res.email}.`
      );
      setPublicToken(res.devToken ?? "");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal mengirim consent.");
    } finally {
      setActingId(null);
    }
  };

  /**
   * Fase 4 — minta email bila waiver belum punya host_email, karena backend
   * menolak send tanpa email penerima (400).
   */
  const requestSend = (waiver: BackendWaiver) => {
    if (waiver.host_email) {
      void handleSend(waiver.id);
      return;
    }
    setSendTarget(waiver);
    setSendEmail("");
  };

  const confirmSend = async () => {
    if (!sendTarget) return;
    const email = sendEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setActionError("Email penerima consent wajib diisi dengan format yang benar.");
      return;
    }
    const id = sendTarget.id;
    setSendTarget(null);
    await handleSend(id, email);
  };

  const handleRevoke = async (id: string) => {
    setActingId(id);
    setActionError(null);
    try {
      await waiverService.revoke(id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal merevoke token.");
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
    } catch (e) {
      setPublicResult(e instanceof Error ? e.message : "Verifikasi token gagal.");
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
    } catch (e) {
      setPublicResult(
        e instanceof ApiError && e.status === 409
          ? "Token sudah dipakai dengan keputusan berbeda (409 Conflict)."
          : e instanceof Error
            ? e.message
            : "Public decision gagal."
      );
    }
  };

  const counts = {
    PENDING: waivers.filter((w) => lifecycleOf(w) === "PENDING").length,
    APPROVED: waivers.filter((w) => lifecycleOf(w) === "APPROVED").length,
    REJECTED: waivers.filter((w) => lifecycleOf(w) === "REJECTED").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Waiver Visitor</h1>
        <p className="text-sm text-slate-500">
          Kelola waiver untuk visitor tanpa MCU — tersimpan di backend sesuai site scope Anda
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nama visitor / perusahaan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
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
          {waivers.map((waiver) => {
            const lifecycle = lifecycleOf(waiver);
            const consent = waiver.waiver_consent;
            const busy = actingId === waiver.id;
            return (
              <Card key={waiver.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{waiver.visitor_name}</p>
                    <p className="text-xs text-slate-500">
                      {waiver.company ?? "-"} · {waiver.site?.name ?? "Tanpa site"} ·{" "}
                      {formatDate(waiver.created_at ?? waiver.valid_until)}
                    </p>
                    <p className="text-xs text-slate-500">Tujuan: {waiver.purpose}</p>
                    {waiver.deviation && (
                      <p className="text-xs text-slate-500">Deviasi: {waiver.deviation}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      Berlaku s/d {formatDate(waiver.valid_until)}
                    </p>
                    {consent && (
                      <p className="text-xs text-slate-500">
                        Consent: {consent.decision ?? "-"}
                        {consent.used_at ? " · sudah dipakai" : ""}
                        {consent.revoked_at ? " · direvoke" : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={BADGE_VARIANT[lifecycle] ?? "default"}>{lifecycle}</Badge>
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
                        onClick={() => requestSend(waiver)}
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
                </div>
              </Card>
            );
          })}
        </div>
      )}

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

      {/* Fase 4 — input email penerima bila waiver belum memiliki host_email */}
      <Modal
        open={sendTarget !== null}
        onClose={() => setSendTarget(null)}
        title="Kirim Consent Waiver"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Waiver <span className="font-medium">{sendTarget?.visitor_name}</span> belum memiliki
            email host. Masukkan email penerima consent untuk mengirim token verifikasi.
          </p>
          <Input
            label="Email Penerima"
            type="email"
            value={sendEmail}
            onChange={(e) => setSendEmail(e.target.value)}
            placeholder="nama@contoh.com"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSendTarget(null)}>
              Batal
            </Button>
            <Button onClick={confirmSend} disabled={actingId !== null}>
              <Send className="size-3.5" />
              Kirim Consent
            </Button>
          </div>
        </div>
      </Modal>

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
