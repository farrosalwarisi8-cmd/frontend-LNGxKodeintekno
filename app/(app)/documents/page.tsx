"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useRef, useState } from "react";
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
  type BackendDocument,
  type RenderPdfResult,
  type SignatureRequest,
} from "@/lib/services/document.service";
import { isBackendFeatureUnavailable } from "@/lib/services/backend-availability";
import {
  FileText,
  Download,
  ShieldCheck,
  ExternalLink,
  QrCode,
  PenLine,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface DocumentRecord {
  id: string;
  documentType: string;
  referenceId: string;
  title: string;
  createdAt: string;
  renderResult?: RenderPdfResult;
  signature?: SignatureRequest;
}

const SIG_STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  PENDING: "warning",
  PROCESSING: "info",
  SIGNED: "success",
  FAILED: "danger",
  EXPIRED: "danger",
};

const SIG_STATUS_ICON: Record<string, typeof Clock> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  SIGNED: CheckCircle,
  FAILED: XCircle,
  EXPIRED: AlertTriangle,
};

/**
 * Petakan row `GET /documents` (backend) ke tipe tampilan halaman ini.
 * - `signature` : signature request terakhir pada dokumen (bila ada).
 * - `renderResult` disintesis dari `qr_token` sehingga tombol verifikasi QR
 *   tetap bisa dibuka untuk dokumen yang sudah ada di backend.
 */
function mapBackendDocument(doc: BackendDocument): DocumentRecord {
  const sig = doc.signature_reqs?.[doc.signature_reqs.length - 1];
  const qrToken = doc.qr_token?.token_hash ?? undefined;
  return {
    id: doc.id,
    documentType: doc.document_type ?? "DOCUMENT",
    referenceId: "",
    title: doc.title ?? "Dokumen",
    createdAt: doc.created_at ?? "",
    renderResult: qrToken
      ? {
          documentId: doc.id,
          title: doc.title ?? "",
          objectKey: doc.object_key ?? "",
          qrToken,
          verificationUrl: `/verify/${qrToken}`,
        }
      : undefined,
    signature: sig
      ? {
          id: sig.id ?? "",
          document_id: doc.id,
          status: sig.status ?? "PENDING",
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
  // GET /signatures/:id & POST /signatures/:id/retry belum terdaftar di backend.
  // Selama itu terjadi, polling dan tombol retry dimatikan agar tidak menembak
  // route yang tidak ada berulang kali.
  const [signatureGap, setSignatureGap] = useState<string | null>(null);

  // Modal pembuatan dokumen baru — POST /documents/render-pdf
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [renderType, setRenderType] = useState("FTW_CERTIFICATE");
  const [renderMcuId, setRenderMcuId] = useState("");
  const [renderTitle, setRenderTitle] = useState("");

  // Polling untuk PENDING/PROCESSING signatures
  const [polling, setPolling] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

  // Auto-refresh: cek apakah ada signature PENDING/PROCESSING
  const hasActiveSignatures = documents.some(
    (d) => d.signature && (d.signature.status === "PENDING" || d.signature.status === "PROCESSING")
  );

  const refreshSignatureStatuses = useCallback(async () => {
    // Refresh each PENDING/PROCESSING signature individually
    const activeDocs = documents.filter(
      (d) => d.signature && (d.signature.status === "PENDING" || d.signature.status === "PROCESSING")
    );
    for (const doc of activeDocs) {
      if (!doc.signature) continue;
      try {
        const updated = await documentService.getSignature(doc.signature.id);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, signature: updated } : d
          )
        );
      } catch (e) {
        if (isBackendFeatureUnavailable(e)) {
          setSignatureGap(e.message);
          return;
        }
        // silent fail per document (mis. 403 per-dokumen)
      }
    }
  }, [documents]);

  useEffect(() => {
    if (!polling || !hasActiveSignatures || signatureGap) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (!pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void refreshSignatureStatuses();
      }, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [polling, hasActiveSignatures, refreshSignatureStatuses, signatureGap]);

  /** Render dokumen baru di backend, lalu muat ulang daftar dari GET /documents. */
  const handleRenderPdf = async () => {
    const mcu = mcus.find((m) => m.id === renderMcuId);
    if (!mcu) {
      setGenError("Pilih siklus MCU sebagai referensi dokumen.");
      return;
    }
    const fallbackTitle =
      renderType === "FTW_CERTIFICATE"
        ? `Sertifikat Kelaikan Kerja ${mcu.mcuNumber}`
        : `${renderType} ${mcu.mcuNumber}`;
    const title = renderTitle.trim() || fallbackTitle;
    setGenerating(true);
    setGenError(null);
    try {
      await documentService.renderPdf(renderType, mcu.id, title);
      setShowRenderModal(false);
      setRenderTitle("");
      await loadDocuments();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Gagal membuat dokumen PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRequestSignature = async (doc: DocumentRecord) => {
    setGenerating(true);
    setGenError(null);
    try {
      // signatureType wajib enum backend (INTERNAL_PIN | CERTIFIED_PSRE)
      const sig = await documentService.requestSignature(
        doc.renderResult?.documentId ?? doc.id,
        "CERTIFIED_PSRE"
      );
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, signature: sig } : d))
      );
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Gagal meminta tanda tangan.");
    } finally {
      setGenerating(false);
    }
  };

  const handleRetrySignature = async (doc: DocumentRecord) => {
    if (!doc.signature) return;
    setRetryingId(doc.id);
    setGenError(null);
    try {
      const updated = await documentService.retrySignature(doc.signature.id);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, signature: updated } : d))
      );
    } catch (e) {
      if (isBackendFeatureUnavailable(e)) {
        setSignatureGap(e.message);
      } else {
        setGenError(e instanceof Error ? e.message : "Gagal retry signature.");
      }
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dokumen & Tanda Tangan</h1>
          <p className="text-sm text-slate-500">
            Daftar dokumen dari backend, render PDF, dan tanda tangan digital
          </p>
        </div>
        <Can action="documents.request-signature">
          <Button
            onClick={() => {
              setGenError(null);
              setShowRenderModal(true);
            }}
          >
            <FileText className="size-4" />
            Render PDF
          </Button>
        </Can>
      </div>

      {genError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {genError}
        </div>
      )}

      {signatureGap && (
        <div
          className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800"
          role="status"
        >
          <p className="font-medium">Status tanda tangan tidak dapat dilacak</p>
          <p className="mt-1">{signatureGap}</p>
        </div>
      )}

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
                const canRetry =
                  !signatureGap &&
                  doc.signature &&
                  (doc.signature.status === "FAILED" || doc.signature.status === "EXPIRED") &&
                  retryingId !== doc.id;
                const isPolling =
                  doc.signature &&
                  (doc.signature.status === "PENDING" || doc.signature.status === "PROCESSING");

                return (
                  <Card key={doc.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{doc.title}</p>
                          <p className="text-xs text-slate-500">
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
                              <Badge
                                variant={SIG_STATUS_VARIANT[doc.signature.status] ?? "default"}
                              >
                                {(() => {
                                  const Icon =
                                    SIG_STATUS_ICON[doc.signature.status] ?? Clock;
                                  return (
                                    <Icon
                                      className={`mr-1 size-3 ${isPolling ? "animate-spin" : ""}`}
                                    />
                                  );
                                })()}
                                Signature: {doc.signature.status}
                              </Badge>
                            )}
                            {doc.signature?.provider_code && (
                              <Badge variant="default">
                                {doc.signature.provider_code}
                              </Badge>
                            )}
                            {doc.signature?.retry_count != null &&
                              doc.signature.retry_count > 0 && (
                                <span className="text-xs text-slate-500">
                                  Retry: {doc.signature.retry_count}x
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {doc.renderResult && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              window.open(
                                doc.renderResult!.verificationUrl,
                                "_blank",
                                "noopener"
                              )
                            }
                          >
                            <QrCode className="size-3.5" />
                            Verifikasi
                          </Button>
                        )}
                        {!doc.signature && (
                          <Can action="documents.request-signature">
                            <Button
                              size="sm"
                              onClick={() => handleRequestSignature(doc)}
                              disabled={generating}
                            >
                              <PenLine className="size-3.5" />
                              Tanda Tangan
                            </Button>
                          </Can>
                        )}
                        {canRetry && (
                          <Can action="documents.request-signature">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetrySignature(doc)}
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
                      <div className="mt-3 rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-medium text-slate-700">Detail Dokumen:</p>
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Document ID:</span>{" "}
                            <span className="font-mono">{doc.renderResult.documentId}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Object Key:</span>{" "}
                            <span className="font-mono">{doc.renderResult.objectKey}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">QR Token:</span>{" "}
                            <span className="font-mono">{doc.renderResult.qrToken}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">Verification URL:</span>{" "}
                            <a
                              href={doc.renderResult.verificationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:underline"
                            >
                              Buka <ExternalLink className="inline size-3" />
                            </a>
                          </p>
                          {doc.signature?.status === "SIGNED" && (
                            <div className="mt-2 rounded-lg bg-success-50 p-2">
                              <p className="text-xs text-success-700">
                                <ShieldCheck className="mr-1 inline size-3" />
                                Tanda tangan sudah SIGNED — berkas ditandatangani
                                provider (lihat tab Tanda Tangan untuk audit trail).
                              </p>
                            </div>
                          )}
                          {doc.signature?.last_error && (
                            <div className="mt-2 rounded-lg bg-danger-50 p-2">
                              <p className="text-xs text-danger-700">
                                <XCircle className="mr-1 inline size-3" />
                                Error: {doc.signature.last_error}
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Tracking semua signature request — auto-refresh setiap 5 detik untuk status PENDING/PROCESSING
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPolling((p) => !p)}
            >
              <RefreshCw className={`size-4 ${polling ? "animate-spin" : ""}`} />
              {polling ? "ON" : "OFF"}
            </Button>
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
        description="Buat dokumen resmi di backend: sertifikat FTW, resume MCU, atau surat sakit."
      >
        <div className="space-y-4 p-6">
          <Select
            label="Jenis Dokumen"
            value={renderType}
            onChange={(e) => setRenderType(e.target.value)}
            options={[
              { value: "FTW_CERTIFICATE", label: "Sertifikat Kelaikan Kerja (FTW)" },
              { value: "MCU_RESUME", label: "Resume Medis MCU" },
              { value: "SICK_LEAVE", label: "Surat Sakit (Sick Leave)" },
            ]}
          />

          <Select
            label="Referensi Siklus MCU"
            value={renderMcuId}
            onChange={(e) => setRenderMcuId(e.target.value)}
            placeholder="Pilih siklus MCU..."
            options={mcus.map((m) => ({
              value: m.id,
              label: `${m.mcuNumber} · ${m.type}`,
            }))}
            helper="Dipakai backend sebagai referensi dokumen (field referenceId)."
          />

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
    </div>
  );
}
