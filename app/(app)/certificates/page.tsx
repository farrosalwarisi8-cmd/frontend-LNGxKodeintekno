"use client";

import { Can, useCan } from "@/components/can";

import { useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncCertificates, syncMcu, syncPatients, useSyncedModules } from "@/lib/remote-sync";
import {
  documentService,
  verifyTokenFromUrl,
  type BackendSignatureType,
  type PublicVerifyResult,
} from "@/lib/services/document.service";
import { CERT_STATUS } from "@/lib/constants";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { Search, BadgeCheck, Plus, QrCode, ShieldCheck, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { classifyVerifyResult } from "@/features/tte/verify-state";
import {
  BACKEND_SIGNATURE_TYPES,
  SIGNATURE_TYPE_LABEL,
} from "@/features/tte/validation";
import { mapTteError, type TteErrorView } from "@/features/tte/error-mapping";
import { formatErrorMessage } from "@/features/tte/messages";

interface IssueTarget {
  mcuId: string;
  mcuNumber: string;
  patientName: string;
  decision: string;
  validUntil: string;
}

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

  // Konfirmasi eksplisit sebelum render + request TTE. Satu klik pada
  // "Terbitkan" hanya membuka dialog; tidak ada request sebelum konfirmasi.
  const [issueTarget, setIssueTarget] = useState<IssueTarget | null>(null);
  const [issueType, setIssueType] = useState<BackendSignatureType>("CERTIFIED_PSRE");
  const [issueError, setIssueError] = useState<string | null>(null);
  const issueInFlightRef = useRef(false);

  // Fase 6 — QR verification modal
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrVerifying, setQrVerifying] = useState(false);
  const [qrResult, setQrResult] = useState<PublicVerifyResult | null>(null);
  const [qrError, setQrError] = useState<TteErrorView | null>(null);
  // Token QR mentah dari response render disimpan HANYA di memori komponen
  // (ref, bukan state yang dirender). Zustand store dipersist ke localStorage —
  // token TIDAK pernah ditaruh di sana. `token_hash` dari GET /documents bukan
  // token verifikasi dan tidak dipakai.
  const qrTokenRef = useRef<string>("");
  const [ephemeralQrTokens, setEphemeralQrTokens] = useState<Record<string, string>>({});

  // Modul 9 — data MCU & pekerja dari backend untuk menerbitkan sertifikat;
  // daftar sertifikat + QR-nya diambil dari dokumen FTW backend.
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncMcu(1, 100);
    await syncCertificates(1, 100);
  });

  /**
   * Membuka dialog konfirmasi. Belum ada request ke backend pada langkah ini.
   */
  const openIssueDialog = (mcuId: string) => {
    const mcu = mcus.find((m) => m.id === mcuId);
    if (!mcu) return;
    const emp = employees.find((e) => e.id === mcu.employeeId);
    setIssueError(null);
    setMsg(null);
    setIssueType("CERTIFIED_PSRE");
    setIssueTarget({
      mcuId,
      mcuNumber: mcu.mcuNumber,
      patientName: emp?.fullName ?? "Pekerja",
      decision: mcu.decision ?? "—",
      validUntil: mcu.validUntil ?? "—",
    });
  };

  /**
   * Setelah konfirmasi:
   *  1. POST /api/v1/documents/render-pdf  -> dokumen + QR token
   *  2. POST /api/v1/signatures/request     -> permintaan tanda tangan PSrE
   *
   * Body request hanya berisi field kontrak (documentId, signatureType).
   * Browser tidak mengirim secret, callback URL, atau data provider.
   */
  const confirmIssue = async () => {
    if (!issueTarget || issueInFlightRef.current) return;
    if (!can("documents.request-signature")) {
      setIssueError("Anda tidak memiliki izin untuk meminta tanda tangan dokumen.");
      return;
    }
    issueInFlightRef.current = true;
    setBusy(true);
    setIssueError(null);
    setMsg(null);
    try {
      const localId = issueCertificate(issueTarget.mcuId);
      const doc = await documentService.renderPdf(
        "FTW_CERTIFICATE",
        issueTarget.mcuId,
        `Sertifikat Kelaikan Kerja ${issueTarget.mcuNumber}`
      );
      await documentService.requestSignature(doc.documentId, issueType);
      const qrToken = verifyTokenFromUrl(doc.verificationUrl);
      if (qrToken && localId) {
        setEphemeralQrTokens((prev) => ({ ...prev, [localId]: qrToken }));
      }
      setIssueTarget(null);
      setMsg(
        "Permintaan tanda tangan dikirim ke backend. Status akan diverifikasi melalui halaman publik."
      );
    } catch (e) {
      setIssueError(formatErrorMessage(e));
    } finally {
      setBusy(false);
      issueInFlightRef.current = false;
    }
  };

  /**
   * Verifikasi QR dari UI (memanggil endpoint publik backend).
   * Token hanya hidup di memori; tidak dirender, tidak dicatat, tidak
   * disimpan ke localStorage. Pesan error backend tidak diteruskan mentah.
   */
  const handleVerifyQr = async (token: string) => {
    if (!token) return;
    qrTokenRef.current = token;
    setShowQrModal(true);
    setQrVerifying(true);
    setQrResult(null);
    setQrError(null);
    try {
      const result = await documentService.verifyPublic(token);
      setQrResult(result);
    } catch (e) {
      setQrError(mapTteError(e));
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

  const verificationView = classifyVerifyResult(qrResult, {
    // Modal hanya dibuka dari handleVerifyQr dengan token non-kosong; turunkan
    // dari state render (bukan membaca ref saat render).
    hasToken: Boolean(qrResult || qrError || qrVerifying),
    hasError: Boolean(qrError),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sertifikat Kesehatan</h1>
        <p className="text-sm text-muted-foreground">Sertifikat kesehatan kerja dengan QR verification</p>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700" role="alert">
          Gagal memuat data dari backend: {error}{" "}
          <button className="underline" onClick={refetch}>Coba lagi</button>
        </div>
      )}
      {msg && (
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700" role="status">
          {msg}
        </div>
      )}
      {loading && !error && (
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
          <h2 className="mb-2 text-sm font-medium text-primary-700">MCU Approved — Belum Ada Sertifikat</h2>
          <div className="space-y-2">
            {approvedMCUs.map((mcu) => {
              const emp = employees.find((e) => e.id === mcu.employeeId);
              return (
                <div key={mcu.id} className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-card p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{emp?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{mcu.mcuNumber} · {mcu.decision}</p>
                  </div>
                  <Can action="certificates.issue">
                    <Button
                      size="sm"
                      className="min-h-11"
                      onClick={() => openIssueDialog(mcu.id)}
                      disabled={busy}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Terbitkan
                    </Button>
                  </Can>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">{filtered.length} sertifikat</p>

      <div className="space-y-3">
        {filtered.map((cert) => {
          const emp = employees.find((e) => e.id === cert.employeeId);
          const statusMeta = CERT_STATUS[cert.status];
          // Hanya token mentah dari response render sesi ini yang boleh dipakai.
          // `cert.qrToken` (jika ada pada data lama) tidak pernah dipakai karena
          // bukan token verifikasi backend.
          const qrToken = ephemeralQrTokens[cert.id];
          return (
            <Card key={cert.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <BadgeCheck className="size-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{cert.certNumber}</p>
                    <p className="text-xs text-muted-foreground">{emp?.fullName} · {emp?.employeeId}</p>
                    <p className="text-xs text-muted-foreground">
                      {cert.healthStatus} · Berlaku s.d. {formatDate(cert.validUntil)}
                    </p>
                    {cert.restrictions && (
                      <p className="text-xs text-warning-600">Restriction: {cert.restrictions}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge meta={statusMeta} />
                  {/* Verifikasi hanya tersedia bila token mentah berasal dari
                      response backend pada sesi ini. */}
                  {qrToken && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={() => void handleVerifyQr(qrToken)}
                    >
                      <QrCode className="size-3.5" aria-hidden="true" />
                      Verifikasi QR
                    </Button>
                  )}
                  {qrToken && (
                    <Link href={`/verify/${encodeURIComponent(qrToken)}`} target="_blank">
                      <Button variant="outline" size="sm" className="min-h-11">
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                        Buka
                      </Button>
                    </Link>
                  )}
                  {cert.status === "valid" && (
                    <Can action="certificates.revoke">
                      <Button variant="danger" size="sm" className="min-h-11" onClick={() => revokeCertificate(cert.id)}>
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

      {/* Konfirmasi penerbitan + permintaan TTE */}
      <Modal
        open={Boolean(issueTarget)}
        onClose={busy ? () => undefined : () => setIssueTarget(null)}
        title="Konfirmasi Penerbitan Sertifikat & Tanda Tangan"
        description="Periksa ringkasan sebelum dokumen dirender dan dikirim ke provider melalui backend."
      >
        {issueTarget && (
          <div className="space-y-4">
            <dl className="space-y-2 rounded-xl border border-border p-3 text-sm">
              <Row label="Siklus MCU" value={issueTarget.mcuNumber} />
              <Row label="Pekerja" value={issueTarget.patientName} />
              <Row label="Keputusan" value={issueTarget.decision} />
              <Row label="Masa berlaku" value={issueTarget.validUntil} />
              <Row label="Jenis dokumen" value="Sertifikat Kelaikan Kerja (FTW)" />
              <Row label="Provider" value="Ditentukan backend" />
            </dl>

            <div className="flex gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Dokumen akan dirender dan dikirim ke provider TTE <strong>melalui backend</strong>.
                Browser tidak memanggil provider, tidak mengirim secret, dan tidak
                mengunggah berkas ke alamat eksternal. Backend memvalidasi PDF
                maksimal 15 MB.
              </p>
            </div>

            <Select
              label="Jenis Tanda Tangan"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as BackendSignatureType)}
              options={BACKEND_SIGNATURE_TYPES.map((type) => ({
                value: type,
                label: SIGNATURE_TYPE_LABEL[type],
              }))}
              helper="Nilai harus merupakan enum yang diterima backend."
              disabled={busy}
            />

            {issueError && (
              <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
                {issueError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIssueTarget(null)} disabled={busy} className="min-h-11">
                Batal
              </Button>
              <Button onClick={() => void confirmIssue()} disabled={busy} loading={busy} className="min-h-11">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {busy ? "Memproses..." : "Terbitkan & Minta TTE"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
              Satu klik mengirim satu permintaan. Tombol dinonaktifkan selama proses.
            </p>
          </div>
        )}
      </Modal>

      {/* QR Verification Modal */}
      <Modal
        open={showQrModal}
        onClose={() => {
          setShowQrModal(false);
          setQrResult(null);
          setQrError(null);
          qrTokenRef.current = "";
        }}
        title="Verifikasi QR Sertifikat"
        description="Hasil berasal langsung dari layanan verifikasi publik backend."
      >
        <div className="space-y-4">
          {qrVerifying && (
            <div className="flex flex-col items-center gap-2 py-6" role="status" aria-live="polite">
              <div className="size-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Memverifikasi token...</p>
            </div>
          )}

          {!qrVerifying && qrError && (
            <div className="space-y-3">
              <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
                <p className="font-medium">{qrError.title}</p>
                <p className="mt-1">{qrError.message}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void handleVerifyQr(qrTokenRef.current)}
                >
                  Coba lagi
                </Button>
              </div>
            </div>
          )}

          {!qrVerifying && !qrError && qrResult && verificationView.showAsValid && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-success-50 p-3">
                <ShieldCheck className="size-5 text-success-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-success-700">{verificationView.title}</p>
                  <p className="text-xs text-success-600">{verificationView.description}</p>
                </div>
              </div>
              <div className="space-y-1 rounded-xl bg-muted p-3 text-sm">
                {qrResult.documentType && (
                  <p><span className="font-medium">Jenis:</span> {qrResult.documentType}</p>
                )}
                {qrResult.documentNumber && (
                  <p><span className="font-medium">Nomor:</span> {qrResult.documentNumber}</p>
                )}
                {qrResult.issuedAt && (
                  <p><span className="font-medium">Terbit:</span> {formatDate(qrResult.issuedAt)}</p>
                )}
                {qrResult.signedAt && (
                  <p><span className="font-medium">Ditandatangani:</span> {formatDate(qrResult.signedAt)}</p>
                )}
                {qrResult.certificateSerial && (
                  <p><span className="font-medium">Serial Sertifikat:</span> {qrResult.certificateSerial}</p>
                )}
              </div>
            </div>
          )}

          {!qrVerifying && !qrError && qrResult && !verificationView.showAsValid && (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-danger-50 p-6 text-center" role="status">
              <QrCode className="size-8 text-danger-600" aria-hidden="true" />
              <p className="font-medium text-danger-700">{verificationView.title}</p>
              <p className="text-sm text-danger-600">{verificationView.description}</p>
              <p className="text-xs text-danger-600">{verificationView.hint}</p>
              {verificationView.statusLabel && (
                <Badge variant="outline">Status backend: {verificationView.statusLabel}</Badge>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-words text-foreground">{value || "—"}</dd>
    </div>
  );
}
