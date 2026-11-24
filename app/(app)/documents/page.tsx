"use client";

import { Can } from "@/components/can";
import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { syncMcu, useSyncedModules } from "@/lib/remote-sync";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { Select } from "@/shared/components/design-system/select";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  documentService,
  verifyTokenFromUrl,
  type BackendDocument,
  type RenderPdfResult,
  type SignatureRequest,
} from "@/lib/services/document.service";
import {
  encounterService,
  type BackendEncounter,
} from "@/lib/services/encounter.service";
import {
  FileText,
  Download,
  ShieldCheck,
  ExternalLink,
  QrCode,
  PenLine,
  XCircle,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useSignaturePolling } from "@/features/tte/hooks/use-signature-polling";
import { SignatureStatusBadge } from "@/features/tte/components/signature-status-badge";
import { RequestSignatureDialog, type SignatureDocumentMeta } from "@/features/tte/components/request-signature-dialog";
import { RetrySignatureDialog } from "@/features/tte/components/retry-signature-dialog";
import { SignedPdfButton } from "@/features/tte/components/signed-pdf-button";
import { mapSignatureStatus } from "@/features/tte/signature-status";
import { maskId } from "@/features/tte/mask";
import { formatErrorMessage, TTE_MESSAGES } from "@/features/tte/messages";
import type { BackendSignatureType } from "@/features/tte/validation";

interface DocumentRecord {
  id: string;
  documentType: string;
  referenceId: string;
  title: string;
  createdAt: string;
  renderResult?: RenderPdfResult;
  signature?: SignatureRequest;
}

/** Jenis dokumen yang dirender dari encounter klinis, bukan siklus MCU. */
const ENCOUNTER_DOC_TYPES = ["MEDICAL_RESUME", "SICK_LEAVE"] as const;

function isEncounterDocType(type: string): boolean {
  return (ENCOUNTER_DOC_TYPES as readonly string[]).includes(type);
}

/**
 * Petakan row `GET /documents` (backend) ke tipe tampilan halaman ini.
 * - `signature` : signature request terakhir pada dokumen (bila ada).
 * - `renderResult` hanya menandai PDF sudah tersedia; token QR mentah tidak
 *   dikembalikan `GET /documents` (hanya `token_hash`) sehingga tautan
 *   verifikasi baru tersedia untuk dokumen yang dirender pada sesi ini.
 */
function mapBackendDocument(doc: BackendDocument): DocumentRecord {
  const sig = doc.signature_reqs?.[doc.signature_reqs.length - 1];
  return {
    id: doc.id,
    documentType: doc.document_type ?? "DOCUMENT",
    referenceId: "",
    title: doc.title ?? "Dokumen",
    createdAt: doc.created_at ?? "",
    renderResult: doc.object_key
      ? {
          documentId: doc.id,
          title: doc.title ?? "",
          status: doc.status,
          objectKey: doc.object_key,
        }
      : undefined,
    signature: sig
      ? {
          id: sig.id ?? "",
          document_id: doc.id,
          // Status kosong TIDAK diisi "PENDING": backend belum mengirim status,
          // sehingga UI menampilkan fallback "tidak dikenali" (bukan status palsu).
          status: sig.status ?? "",
          signature_type: sig.signature_type,
          provider_code: sig.provider_code ?? undefined,
          signed_at: sig.completed_at ?? null,
        }
      : undefined,
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"documents" | "signatures">("documents");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] = useState<SignatureDocumentMeta | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<DocumentRecord | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [retryRelation, setRetryRelation] = useState<{ oldId: string; newId: string } | null>(null);
  const statusRegionRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);
  const retryInFlightRef = useRef(false);

  // Modal pembuatan dokumen baru — POST /documents/render-pdf
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [renderType, setRenderType] = useState("FTW_CERTIFICATE");
  /** ID siklus MCU atau encounter, tergantung `renderType`. */
  const [renderReferenceId, setRenderReferenceId] = useState("");
  const [renderTitle, setRenderTitle] = useState("");

  // Encounter final untuk jenis dokumen klinis (surat sakit / resume medis).
  const [encounters, setEncounters] = useState<BackendEncounter[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [encounterError, setEncounterError] = useState<string | null>(null);

  const usesEncounter = isEncounterDocType(renderType);

  const mcus = useStore((s) => s.mcus);

  /**
   * Modul 9 — daftar dokumen dari backend (`GET /documents`),
   * bukan data MCU lokal yang di-sintesis di client.
   */
  const loadDocuments = useCallback(async () => {
    const res = await documentService.getDocuments({ page: 1, limit: 100 });
    setDocuments((res.data ?? []).map(mapBackendDocument));
  }, []);

  // Sinkronisasi siklus MCU (untuk referensi render) + daftar dokumen.
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncMcu(1, 100);
    await loadDocuments();
  });

  // Satu round-trip GET /documents (signature_reqs ikut di-include backend).
  // Tidak ada endpoint GET /signatures; hook polling memastikan satu request
  // aktif, backoff, berhenti pada status terminal/tab hidden/offline.
  const refreshSignatureStatuses = useCallback(async () => {
    const res = await documentService.getDocuments({ page: 1, limit: 100 });
    setDocuments((res.data ?? []).map(mapBackendDocument));
  }, []);

  const signatureStatuses = useMemo(
    () => documents.map((d) => d.signature?.status),
    [documents]
  );
  const polling = useSignaturePolling(signatureStatuses, refreshSignatureStatuses);

  /**
   * Ambil encounter final/locked untuk pemilih referensi. Backend menolak
   * render dari encounter berstatus DRAFT, jadi daftar disaring di client.
   */
  const loadEncounters = useCallback(async () => {
    setLoadingEncounters(true);
    setEncounterError(null);
    try {
      const res = await encounterService.listEncounters({ page: 1, limit: 100 });
      const finalEncounters = (res.data ?? [])
        .filter((enc) => enc.status === "FINAL" || enc.status === "LOCKED")
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
      setEncounters(finalEncounters);
    } catch (e) {
      setEncounterError(
        e instanceof Error ? e.message : "Gagal memuat daftar encounter."
      );
    } finally {
      setLoadingEncounters(false);
    }
  }, []);

  /**
   * Encounter yang memenuhi syarat backend: surat sakit butuh nomor surat pada
   * outside treatment, resume medis butuh SOAP final.
   */
  const eligibleEncounters = encounters.filter((enc) =>
    renderType === "SICK_LEAVE"
      ? enc.outside_treatments?.some((item) => item.sick_letter_no)
      : Boolean(enc.soap_note && enc.soap_note.status !== "DRAFT")
  );

  /** Render dokumen baru di backend, lalu muat ulang daftar dari GET /documents. */
  const handleRenderPdf = async () => {
    const mcu = usesEncounter ? undefined : mcus.find((m) => m.id === renderReferenceId);
    const encounter = usesEncounter
      ? eligibleEncounters.find((enc) => enc.id === renderReferenceId)
      : undefined;
    if (usesEncounter ? !encounter : !mcu) {
      setGenError(
        usesEncounter
          ? "Pilih encounter final yang memenuhi syarat dokumen."
          : "Pilih siklus MCU sebagai referensi dokumen."
      );
      return;
    }
    const patientName = encounter?.patient?.full_name?.trim() || "Pasien";
    const fallbackTitle =
      renderType === "FTW_CERTIFICATE"
        ? `Sertifikat Kelaikan Kerja ${mcu?.mcuNumber}`
        : renderType === "MCU_RESUME"
          ? `Resume Medis MCU ${mcu?.mcuNumber}`
          : renderType === "SICK_LEAVE"
            ? `Surat Keterangan Sakit ${patientName}`
            : `Resume Medis ${patientName}`;
    const title = renderTitle.trim() || fallbackTitle;
    const referenceId = mcu?.id ?? encounter!.id;
    setGenerating(true);
    setGenError(null);
    try {
      const result = await documentService.renderPdf(renderType, referenceId, title);
      const { verificationUrl } = result;
      const token = verifyTokenFromUrl(verificationUrl);
      setShowRenderModal(false);
      setRenderTitle("");
      await loadDocuments();
      // Token QR mentah hanya ada pada respons render; simpan agar tautan
      // verifikasi bisa dibuka dari daftar sebelum halaman dimuat ulang.
      if (verificationUrl && token) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === result.documentId
              ? {
                  ...d,
                  renderResult: {
                    ...d.renderResult,
                    documentId: result.documentId,
                    title: result.title,
                    status: result.status,
                    sha256Hash: result.sha256Hash,
                    verificationUrl,
                  },
                }
              : d
          )
        );
      }
    } catch (e) {
      setGenError(formatErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  /** Buka modal konfirmasi — belum ada request ke backend pada langkah ini. */
  const openRequestDialog = (doc: DocumentRecord) => {
    setRequestError(null);
    setStatusMessage(null);
    setRequestTarget({
      recordId: doc.id,
      id: doc.renderResult?.documentId ?? doc.id,
      title: doc.title,
      documentType: doc.documentType,
      createdAt: doc.createdAt,
      status: doc.renderResult?.status ?? doc.signature?.status,
      objectKey: doc.renderResult?.objectKey,
      sizeBytes: null,
      signerName: null,
      signerEmail: null,
      providerCode: doc.signature?.provider_code,
    });
  };

  /** Satu klik = satu POST /signatures/request (dijaga in-flight ref + disabled). */
  const handleRequestSignature = async (signatureType: BackendSignatureType) => {
    if (!requestTarget || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setRequestBusy(true);
    setRequestError(null);
    try {
      const sig = await documentService.requestSignature(requestTarget.id, signatureType);
      setDocuments((prev) =>
        prev.map((d) => (d.id === requestTarget.recordId ? { ...d, signature: sig } : d))
      );
      setRequestTarget(null);
      setStatusMessage(TTE_MESSAGES.requestSubmitted);
      statusRegionRef.current?.focus();
    } catch (e) {
      setRequestError(formatErrorMessage(e));
    } finally {
      setRequestBusy(false);
      requestInFlightRef.current = false;
    }
  };

  const openRetryDialog = (doc: DocumentRecord) => {
    setRetryError(null);
    setStatusMessage(null);
    setRetryTarget(doc);
  };

  /** Retry membuat request BARU — relasi lama/baru ditampilkan eksplisit. */
  const handleRetrySignature = async () => {
    if (!retryTarget?.signature || retryInFlightRef.current) return;
    const oldId = retryTarget.signature.id;
    retryInFlightRef.current = true;
    setRetryingId(retryTarget.id);
    setRetryError(null);
    try {
      const updated = await documentService.retrySignature(oldId);
      setDocuments((prev) =>
        prev.map((d) => (d.id === retryTarget.id ? { ...d, signature: updated } : d))
      );
      setRetryRelation({ oldId, newId: updated.id });
      setRetryTarget(null);
      setStatusMessage(TTE_MESSAGES.retrySubmitted);
      statusRegionRef.current?.focus();
    } catch (e) {
      setRetryError(formatErrorMessage(e));
    } finally {
      setRetryingId(null);
      retryInFlightRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dokumen & Tanda Tangan</h1>
          <p className="text-sm text-muted-foreground">
            Daftar dokumen dari backend, render PDF, dan tanda tangan digital
          </p>
        </div>
        <Can action="documents.render">
          <Button
            onClick={() => {
              setGenError(null);
              setShowRenderModal(true);
            }}
            className="min-h-11"
          >
            <FileText className="size-4" />
            Render PDF
          </Button>
        </Can>
      </div>

      {!polling.online && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700" role="alert">
          <WifiOff className="size-4" aria-hidden="true" />
          Anda sedang offline. Status akan diperbarui saat koneksi kembali; tombol
          refresh manual tetap tersedia.
        </div>
      )}

      {genError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
          {genError}
        </div>
      )}

      {/* Fokus berpindah ke sini setelah request/retry (accessible status). */}
      <div
        ref={statusRegionRef}
        tabIndex={-1}
        aria-live="polite"
        role="status"
        className="sr-only focus:not-sr-only focus:rounded-xl focus:border focus:border-primary focus:bg-primary-50 focus:p-3 focus:text-sm focus:text-primary-700"
      >
        {statusMessage ?? ""}
        {retryRelation
          ? ` Request lama ${maskId(retryRelation.oldId)} digantikan request baru ${maskId(retryRelation.newId)}.`
          : ""}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "documents" ? "primary" : "outline"}
          onClick={() => setActiveTab("documents")}
        >
          <FileText className="size-4" />
          Dokumen
        </Button>
        <Button
          variant={activeTab === "signatures" ? "primary" : "outline"}
          onClick={() => setActiveTab("signatures")}
        >
          <PenLine className="size-4" />
          Tanda Tangan
        </Button>
      </div>

      {activeTab === "documents" && (
        <>
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && error && (
            <ErrorState title="Gagal memuat dokumen" message={error} onRetry={refetch} />
          )}

          {!loading && !error && documents.length === 0 && (
            <EmptyState
              title="Belum ada dokumen"
              description="Dokumen akan muncul setelah dokumen dirender di backend."
              icon={FileText}
            />
          )}

          {!loading && !error && documents.length > 0 && (
            <div className="space-y-3">
              {documents.map((doc) => {
                const statusView = mapSignatureStatus(doc.signature?.status);
                const canRetry = Boolean(
                  doc.signature && statusView.canRetry && retryingId !== doc.id
                );
                const isPolling = Boolean(doc.signature && statusView.isActive);

                return (
                  <Card key={doc.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.documentType} · {formatDate(doc.createdAt)}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {doc.renderResult && (
                              <Badge variant="success">
                                <ShieldCheck className="mr-1 size-3" />
                                PDF Ready
                              </Badge>
                            )}
                            {doc.signature && (
                              <SignatureStatusBadge
                                status={doc.signature.status}
                                animate={isPolling}
                              />
                            )}
                            {doc.signature && !statusView.known && (
                              <span className="text-xs text-muted-foreground">
                                Status backend: {statusView.status || "—"}
                              </span>
                            )}
                            {doc.signature?.provider_code && (
                              <Badge variant="default">
                                {doc.signature.provider_code}
                              </Badge>
                            )}
                            {doc.signature?.retry_count != null &&
                              doc.signature.retry_count > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Retry: {doc.signature.retry_count}x
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Can action="documents.download-signed">
                          <SignedPdfButton
                            documentId={doc.renderResult?.documentId ?? doc.id}
                            title={doc.title}
                            canDownload={statusView.canDownload}
                            compact
                          />
                        </Can>
                        {doc.renderResult?.verificationUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11"
                            aria-label={`Verifikasi dokumen ${doc.title}`}
                            onClick={() => {
                              const token = verifyTokenFromUrl(
                                doc.renderResult!.verificationUrl
                              );
                              if (token) {
                                window.open(
                                  `/verify/${encodeURIComponent(token)}`,
                                  "_blank",
                                  "noopener"
                                );
                              }
                            }}
                          >
                            <QrCode className="size-3.5" />
                            Verifikasi
                          </Button>
                        )}
                        {!doc.signature && (
                          <Can action="documents.request-signature">
                            <Button
                              size="sm"
                              className="min-h-11"
                              onClick={() => openRequestDialog(doc)}
                            >
                              <PenLine className="size-3.5" />
                              Request TTE
                            </Button>
                          </Can>
                        )}
                        {canRetry && (
                          <Can action="documents.retry-signature">
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11"
                              onClick={() => openRetryDialog(doc)}
                              disabled={retryingId === doc.id}
                            >
                              <RefreshCw className="size-3.5" />
                              {retryingId === doc.id ? "Retrying..." : "Retry"}
                            </Button>
                          </Can>
                        )}
                      </div>
                    </div>

                    {/* Signed URL / Object Key info */}
                    {doc.renderResult && (
                      <div className="mt-3 rounded-xl border border-border p-3">
                        <p className="text-xs font-medium text-text-secondary">Detail Dokumen:</p>
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Document ID:</span>{" "}
                            <span className="font-mono">{doc.renderResult.documentId}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Object Key:</span>{" "}
                            <span className="font-mono">{doc.renderResult.objectKey ?? "—"}</span>
                          </p>
                          {doc.renderResult.sha256Hash && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">SHA-256:</span>{" "}
                              <span className="font-mono break-all">
                                {doc.renderResult.sha256Hash}
                              </span>
                            </p>
                          )}
                          {doc.renderResult.verificationUrl && (
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Verifikasi publik:</span>{" "}
                              <a
                                href={`/verify/${encodeURIComponent(
                                  verifyTokenFromUrl(doc.renderResult.verificationUrl) ?? ""
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:underline"
                              >
                                Buka <ExternalLink className="inline size-3" />
                              </a>
                            </p>
                          )}
                          {doc.signature && statusView.isSigned && (
                            <div className="mt-2 rounded-lg bg-success-50 p-2">
                              <p className="text-xs text-success-700">
                                <ShieldCheck className="mr-1 inline size-3" />
                                Backend melaporkan status SIGNED. Unduh PDF bertanda
                                tangan melalui tombol resmi di atas.
                              </p>
                            </div>
                          )}
                          {doc.signature?.last_error && (
                            <div className="mt-2 rounded-lg bg-danger-50 p-2" role="alert">
                              <p className="text-xs text-danger-700">
                                <XCircle className="mr-1 inline size-3" />
                                Permintaan sebelumnya gagal. Periksa status lalu
                                gunakan Retry bila masih diperlukan.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "signatures" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Tracking signature request — poll hanya untuk PENDING/PROCESSING,
                berhenti otomatis pada status akhir dan saat tab tersembunyi.
              </p>
              <p className="mt-1 text-xs text-muted-foreground" role="status" aria-live="polite">
                {polling.lastUpdated
                  ? `Terakhir diperbarui: ${polling.lastUpdated.toLocaleTimeString("id-ID")}`
                  : "Belum ada pembaruan pada sesi ini."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => void polling.refreshNow()}
                disabled={polling.refreshing}
                loading={polling.refreshing}
                aria-label="Refresh status tanda tangan sekarang"
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => polling.setEnabled(!polling.enabled)}
                aria-pressed={polling.enabled}
              >
                Auto-refresh {polling.enabled ? "ON" : "OFF"}
              </Button>
            </div>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-3 rounded-xl bg-primary-50 p-3">
              <PenLine className="size-5 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-primary-700">
                  Halaman Signature Tracking tersedia
                </p>
                <p className="text-xs text-primary-600">
                  Kunjungi <span className="font-mono">/signatures</span> untuk melihat semua signature request dengan status, retry, dan audit trail.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modal render dokumen baru — POST /documents/render-pdf */}
      <Modal
        open={showRenderModal}
        onClose={() => setShowRenderModal(false)}
        title="Render Dokumen PDF"
        description="Buat dokumen resmi di backend dari siklus MCU atau encounter klinis final."
      >
        <div className="space-y-4 p-6">
          <Select
            label="Jenis Dokumen"
            value={renderType}
            onChange={(e) => {
              const nextType = e.target.value;
              setRenderType(nextType);
              setRenderReferenceId("");
              if (isEncounterDocType(nextType) && encounters.length === 0) {
                void loadEncounters();
              }
            }}
            options={[
              { value: "FTW_CERTIFICATE", label: "Sertifikat Kelaikan Kerja (FTW)" },
              { value: "MCU_RESUME", label: "Resume Medis MCU" },
              { value: "MEDICAL_RESUME", label: "Resume Medis Kunjungan" },
              { value: "SICK_LEAVE", label: "Surat Keterangan Sakit" },
            ]}
            helper="Dokumen MCU memakai siklus MCU; surat sakit & resume kunjungan memakai encounter final."
          />

          {usesEncounter ? (
            <Select
              label="Referensi Encounter"
              value={renderReferenceId}
              onChange={(e) => setRenderReferenceId(e.target.value)}
              placeholder={
                loadingEncounters ? "Memuat encounter..." : "Pilih encounter final..."
              }
              disabled={loadingEncounters || eligibleEncounters.length === 0}
              options={eligibleEncounters.map((enc) => ({
                value: enc.id,
                label: `${enc.patient?.full_name ?? "Pasien"} · ${
                  enc.patient?.medical_record_no ?? enc.patient_id.slice(0, 8)
                } · ${enc.started_at ? formatDate(enc.started_at) : "—"}`,
              }))}
              helper={
                encounterError ??
                (loadingEncounters
                  ? "Mengambil encounter dari backend..."
                  : eligibleEncounters.length === 0
                    ? renderType === "SICK_LEAVE"
                      ? "Belum ada encounter final dengan nomor surat sakit pada outside treatment."
                      : "Belum ada encounter final dengan SOAP yang sudah difinalisasi."
                    : "Hanya encounter FINAL/LOCKED yang ditampilkan.")
              }
            />
          ) : (
            <Select
              label="Referensi Siklus MCU"
              value={renderReferenceId}
              onChange={(e) => setRenderReferenceId(e.target.value)}
              placeholder="Pilih siklus MCU..."
              options={mcus.map((m) => ({
                value: m.id,
                label: `${m.mcuNumber} · ${m.type}`,
              }))}
              helper="Dipakai backend sebagai referensi dokumen (field referenceId)."
            />
          )}

          <Input
            label="Judul Dokumen"
            value={renderTitle}
            onChange={(e) => setRenderTitle(e.target.value)}
            placeholder="cth. Sertifikat Kelaikan Kerja MCU-XXXXXXXX"
            helper="Kosongkan untuk memakai judul baku sesuai jenis dokumen."
          />

          {genError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
              {genError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRenderModal(false)}>
              Batal
            </Button>
            <Button onClick={() => void handleRenderPdf()} disabled={generating}>
              <Download className="size-4" />
              {generating ? "Membuat..." : "Render PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      {requestTarget && (
        <RequestSignatureDialog
          document={requestTarget}
          open
          busy={requestBusy}
          error={requestError}
          onClose={() => setRequestTarget(null)}
          onConfirm={(type) => void handleRequestSignature(type)}
        />
      )}

      {retryTarget?.signature && (
        <RetrySignatureDialog
          open
          oldRequestId={retryTarget.signature.id}
          status={retryTarget.signature.status}
          busy={retryingId === retryTarget.id}
          error={retryError}
          onClose={() => setRetryTarget(null)}
          onConfirm={() => void handleRetrySignature()}
        />
      )}
    </div>
  );
}
