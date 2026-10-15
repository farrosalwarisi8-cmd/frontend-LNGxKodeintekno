"use client";

import { Can, useCan } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncCertificates, syncMcu, syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { documentService } from "@/lib/services/document.service";
import { CERT_STATUS } from "@/lib/constants";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { Search, BadgeCheck, Plus, QrCode, ChevronRight, ShieldCheck, ExternalLink } from "lucide-react";

export default function CertificatesPage() {
  const certificates = useStore((s) => s.certificates);
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const issueCertificate = useStore((s) => s.issueCertificate);
  const revokeCertificate = useStore((s) => s.revokeCertificate);
  const can = useCan();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fase 6 — QR verification modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrVerifying, setQrVerifying] = useState(false);
  const [qrResult, setQrResult] = useState<{
    isValid: boolean;
    status: string;
    documentTitle?: string;
    issuer?: string;
    issuedAt?: string;
  } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // Modul 9 — data MCU & pekerja dari backend untuk menerbitkan sertifikat;
  // daftar sertifikat + QR-nya diambil dari dokumen FTW backend.
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncMcu(1, 100);
    await syncCertificates(1, 100);
  });

  /**
   * Menerbitkan sertifikat:
   *  1. POST /api/v1/documents/render-pdf  -> dokumen + QR token
   *  2. POST /api/v1/signatures/request     -> permintaan tanda tangan PSrE
   */
  const handleIssue = async (mcuId: string) => {
    if (!can("documents.request-signature")) {
      setMsg("Anda tidak memiliki izin untuk meminta tanda tangan dokumen.");
      return;
    }
    const localId = issueCertificate(mcuId);
    if (!localId) return;
    setBusy(true);
    setMsg(null);
    try {
      const mcu = mcus.find((m) => m.id === mcuId);
      const doc = await documentService.renderPdf(
        "FTW_CERTIFICATE",
        mcuId,
        `Sertifikat Kelaikan Kerja ${mcu?.mcuNumber ?? mcuId}`
      );
      await documentService.requestSignature(doc.documentId, "CERTIFIED_PSRE");
      useStore.setState((s) => ({
        certificates: s.certificates.map((c) =>
          c.id === localId ? { ...c, qrToken: doc.qrToken } : c
        ),
      }));
      setMsg(`Sertifikat dibuat di backend (QR: ${doc.qrToken.slice(0, 12)}...)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal membuat dokumen di backend.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Fase 6 — Verifikasi QR dari UI (buka halaman /verify/:token)
   */
  const handleVerifyQr = async (token: string) => {
    setQrToken(token);
    setShowQrModal(true);
    setQrVerifying(true);
    setQrResult(null);
    setQrError(null);
    try {
      const result = await documentService.verifyPublic(token);
      setQrResult({
        isValid: result.isValid,
        status: result.status,
        documentTitle: result.documentTitle,
        issuer: result.issuer,
        issuedAt: result.issuedAt,
      });
    } catch (e) {
      setQrError(e instanceof Error ? e.message : "Gagal memverifikasi QR.");
    } finally {
      setQrVerifying(false);
    }
  };

  const filtered = certificates.filter((c) => {
    const emp = employees.find((e) => e.id === c.employeeId);
    const q = search.toLowerCase();
    const matchSearch = !q || c.certNumber.toLowerCase().includes(q) || emp?.fullName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const approvedMCUs = mcus.filter((m) => m.status === "Approved" && !certificates.find((c) => c.mcuId === m.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sertifikat Kesehatan</h1>
        <p className="text-sm text-slate-500">Sertifikat kesehatan kerja dengan QR verification</p>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
          Gagal memuat data dari backend: {error}{" "}
          <button className="underline" onClick={refetch}>Coba lagi</button>
        </div>
      )}
      {msg && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{msg}</div>
      )}
      {loading && !error && (
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nomor sertifikat, nama pekerja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(CERT_STATUS).map(([value, { label }]) => ({ value, label }))}
          />
        </div>
      </Card>

      {approvedMCUs.length > 0 && (
        <Card className="border-primary-200 bg-primary-50/50 p-4">
          <h3 className="mb-2 text-sm font-medium text-primary-700">MCU Approved — Belum Ada Sertifikat</h3>
          <div className="space-y-2">
            {approvedMCUs.map((mcu) => {
              const emp = employees.find((e) => e.id === mcu.employeeId);
              return (
                <div key={mcu.id} className="flex items-center justify-between rounded-xl border border-primary-100 bg-white p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">{mcu.mcuNumber} · {mcu.decision}</p>
                  </div>
                  <Can action="certificates.issue">
                    <Button size="sm" onClick={() => handleIssue(mcu.id)} loading={busy} disabled={busy}>
                      <Plus className="size-3.5" />
                      Terbitkan
                    </Button>
                  </Can>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p className="text-sm text-slate-500">{filtered.length} sertifikat</p>

      <div className="space-y-3">
        {filtered.map((cert) => {
          const emp = employees.find((e) => e.id === cert.employeeId);
          const statusMeta = CERT_STATUS[cert.status];
          return (
            <Card key={cert.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <BadgeCheck className="size-6" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{cert.certNumber}</p>
                    <p className="text-xs text-slate-500">{emp?.fullName} · {emp?.employeeId}</p>
                    <p className="text-xs text-slate-500">
                      {cert.healthStatus} · Berlaku s.d. {formatDate(cert.validUntil)}
                    </p>
                    {cert.restrictions && (
                      <p className="text-xs text-warning-600">Restriction: {cert.restrictions}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusMeta?.color}>
                    {statusMeta?.label}
                  </Badge>
                  {/* Fase 6 — Tombol Verifikasi QR langsung dari sini */}
                  {cert.qrToken && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerifyQr(cert.qrToken)}
                    >
                      <QrCode className="size-3.5" />
                      Verifikasi QR
                    </Button>
                  )}
                  <Link href={`/verify/${encodeURIComponent(cert.qrToken)}`} target="_blank">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="size-3.5" />
                      Buka
                    </Button>
                  </Link>
                  {cert.status === "valid" && (
                    <Can action="certificates.revoke">
                      <Button variant="danger" size="sm" onClick={() => revokeCertificate(cert.id)}>
                        Cabut
                      </Button>
                    </Can>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Fase 6 — QR Verification Modal */}
      <Modal
        open={showQrModal}
        onClose={() => {
          setShowQrModal(false);
          setQrResult(null);
          setQrError(null);
        }}
        title="Verifikasi QR Sertifikat"
      >
        <div className="space-y-4">
          {qrVerifying && (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="size-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              <p className="text-sm text-slate-500">Memverifikasi token...</p>
            </div>
          )}

          {qrError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
              {qrError}
            </div>
          )}

          {qrResult && qrResult.isValid && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-success-50 p-3">
                <ShieldCheck className="size-5 text-success-600" />
                <div>
                  <p className="text-sm font-medium text-success-700">Sertifikat Valid</p>
                  <p className="text-xs text-success-600">{qrResult.status}</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
                <p><span className="font-medium">Judul:</span> {qrResult.documentTitle ?? "—"}</p>
                <p><span className="font-medium">Penerbit:</span> {qrResult.issuer ?? "—"}</p>
                <p><span className="font-medium">Terbit:</span> {qrResult.issuedAt ? formatDate(qrResult.issuedAt) : "—"}</p>
              </div>
            </div>
          )}

          {qrResult && !qrResult.isValid && (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-danger-50 p-6 text-center">
              <QrCode className="size-8 text-danger-600" />
              <p className="font-medium text-danger-700">Sertifikat Tidak Ditemukan</p>
              <p className="text-sm text-danger-600">{qrResult.status}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
