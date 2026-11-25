"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  documentService,
  type SignatureRequest,
} from "@/lib/services/document.service";
import {
  PenLine,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ChevronDown,
  WifiOff,
} from "lucide-react";
import { useSignaturePolling } from "@/features/tte/hooks/use-signature-polling";
import { SignatureStatusBadge } from "@/features/tte/components/signature-status-badge";
import { RetrySignatureDialog } from "@/features/tte/components/retry-signature-dialog";
import { SignedPdfButton } from "@/features/tte/components/signed-pdf-button";
import { mapSignatureStatus } from "@/features/tte/signature-status";
import { maskId } from "@/features/tte/mask";
import { formatErrorMessage, TTE_MESSAGES } from "@/features/tte/messages";
import { useI18n } from "@/lib/i18n";

const SIGNATURE_TYPE_LABEL: Record<string, string> = {
  CERTIFIED_PSRE: "PSrE Tersertifikasi",
  INTERNAL_PIN: "PIN Internal",
};

export default function SignaturesPage() {
  const { t: translate } = useI18n();
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<SignatureRequest | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [retryRelation, setRetryRelation] = useState<{ oldId: string; newId: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const statusRegionRef = useRef<HTMLDivElement | null>(null);
  const retryInFlightRef = useRef(false);

  const load = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    setError(null);
    try {
      const params: { page?: number; limit?: number; status?: string } = {
        page: 1,
        limit: 100,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await documentService.getSignatures(params);
      setSignatures(res.data ?? []);
    } catch (e) {
      setError(formatErrorMessage(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Polling aman: hanya PENDING/PROCESSING, backoff, tab hidden/offline stop,
  // satu interval aktif, cleanup saat unmount/route change/filter change.
  // Filter status yang sedang aktif HARUS ikut diterapkan; sebelumnya refresh
  // otomatis mengembalikan seluruh status dan diam-diam mereset filter pengguna.
  const refreshStatuses = useCallback(async () => {
    const params: { page?: number; limit?: number; status?: string } = {
      page: 1,
      limit: 100,
    };
    if (statusFilter) params.status = statusFilter;
    const res = await documentService.getSignatures(params);
    setSignatures(res.data ?? []);
    setError(null);
  }, [statusFilter]);

  const signatureStatuses = useMemo(() => signatures.map((s) => s.status), [signatures]);
  const polling = useSignaturePolling(signatureStatuses, refreshStatuses);

  useEffect(() => {
    const timer = setTimeout(() => void load().catch(() => undefined), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const confirmRetry = async () => {
    if (!retryTarget || retryInFlightRef.current) return;
    const oldId = retryTarget.id;
    retryInFlightRef.current = true;
    setRetryingId(oldId);
    setRetryError(null);
    try {
      const updated = await documentService.retrySignature(oldId);
      setRetryRelation({ oldId, newId: updated.id });
      setMsg(TTE_MESSAGES.retrySubmitted);
      setRetryTarget(null);
      await refreshStatuses();
      statusRegionRef.current?.focus();
    } catch (e) {
      setRetryError(formatErrorMessage(e));
    } finally {
      setRetryingId(null);
      retryInFlightRef.current = false;
    }
  };

  const filtered = signatures.filter((sig) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      sig.id.toLowerCase().includes(q) ||
      sig.document_id?.toLowerCase().includes(q) ||
      sig.signature_type?.toLowerCase().includes(q) ||
      sig.provider_code?.toLowerCase().includes(q)
    );
  });

  const pendingCount = signatures.filter(
    (s) => mapSignatureStatus(s.status).isActive
  ).length;
  const signedCount = signatures.filter(
    (s) => mapSignatureStatus(s.status).isSigned
  ).length;
  const failedCount = signatures.filter((s) => {
    const view = mapSignatureStatus(s.status);
    return view.isTerminal && !view.isSigned && view.known;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {translate("page.signatures.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate("page.signatures.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => polling.setEnabled(!polling.enabled)}
            aria-pressed={polling.enabled}
          >
            <RefreshCw className={`size-4 ${polling.isPolling ? "animate-spin" : ""}`} />
            Auto-refresh {polling.enabled ? "ON" : "OFF"}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void polling.refreshNow()}
            disabled={polling.refreshing}
            loading={polling.refreshing}
            aria-label="Refresh status tanda tangan sekarang"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {polling.lastUpdated
          ? `Terakhir diperbarui: ${polling.lastUpdated.toLocaleTimeString("id-ID")}`
          : "Belum ada pembaruan pada sesi ini."}
      </p>

      {!polling.online && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700" role="alert">
          <WifiOff className="size-4" aria-hidden="true" />
          Anda sedang offline. Polling dijeda sampai koneksi kembali.
        </div>
      )}

      {/* Fokus berpindah ke sini setelah retry. */}
      <div
        ref={statusRegionRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="sr-only focus:not-sr-only focus:rounded-xl focus:border focus:border-primary focus:bg-primary-50 focus:p-3 focus:text-sm focus:text-primary-700"
      >
        {msg ?? ""}
        {retryRelation
          ? ` Request lama ${maskId(retryRelation.oldId)} digantikan request baru ${maskId(retryRelation.newId)}.`
          : ""}
      </div>

      {msg && (
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700" role="status">
          {msg}
        </div>
      )}
      {retryError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
          {retryError}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending / Processing</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{signedCount}</p>
              <p className="text-xs text-muted-foreground">Signed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600">
              <XCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed / Expired</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Cari ID dokumen / provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "", label: "Semua Status" },
            { value: "PENDING", label: "Pending" },
            { value: "PROCESSING", label: "Processing" },
            { value: "SIGNED", label: "Signed" },
            { value: "FAILED", label: "Failed" },
            { value: "EXPIRED", label: "Expired" },
          ]}
        />
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Gagal memuat tanda tangan" message={error} onRetry={load} />
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="Belum ada signature request"
          description="Signature akan muncul setelah ada dokumen yang diminta tanda tangannya."
          icon={PenLine}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((sig) => {
            const isExpanded = expandedId === sig.id;
            const statusView = mapSignatureStatus(sig.status);
            const canRetry = Boolean(statusView.canRetry && retryingId !== sig.id);
            const isPolling = statusView.isActive;

            return (
              <Card key={sig.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <PenLine className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {SIGNATURE_TYPE_LABEL[sig.signature_type ?? ""] ??
                          sig.signature_type ??
                          "Tanda Tangan"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {sig.id.slice(0, 8)} · Dok: {sig.document_id?.slice(0, 8) ?? "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <SignatureStatusBadge status={sig.status} animate={isPolling} />
                        {sig.provider_code && (
                          <Badge variant="default">{sig.provider_code}</Badge>
                        )}
                        {sig.signed_at && (
                          <span className="text-xs text-success-600">
                            Signed: {formatDate(sig.signed_at)}
                          </span>
                        )}
                        {sig.retry_count && sig.retry_count > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Retry: {sig.retry_count}x
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Can action="documents.retry-signature">
                      {canRetry && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => {
                            setRetryError(null);
                            setRetryTarget(sig);
                          }}
                          disabled={retryingId === sig.id}
                          aria-label={`Retry tanda tangan untuk dokumen ${sig.document_id ?? sig.id}`}
                        >
                          <RefreshCw className="size-3.5" />
                          {retryingId === sig.id ? "Retrying..." : "Retry"}
                        </Button>
                      )}
                    </Can>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => setExpandedId(isExpanded ? null : sig.id)}
                      aria-label={isExpanded ? "Tutup detail signature" : "Lihat detail signature"}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-xs font-medium text-text-secondary">Detail Signature:</p>
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Signature ID:</span>{" "}
                          <span className="font-mono">{sig.id}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Document ID:</span>{" "}
                          <span className="font-mono">{sig.document_id ?? "—"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Certificate Serial:</span>{" "}
                          <span className="font-mono">{sig.certificate_serial ?? "—"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Signed Hash:</span>{" "}
                          <span className="font-mono">
                            {sig.signed_hash ? `${sig.signed_hash.slice(0, 16)}…` : "—"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Requested:</span>{" "}
                          {formatDate(sig.requested_at ?? sig.created_at ?? "")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Expires:</span>{" "}
                          {sig.expires_at ? formatDate(sig.expires_at) : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Updated:</span>{" "}
                          {formatDate(sig.updated_at ?? "")}
                        </p>
                      </div>
                    </div>

                    {/* Error info — pesan netral, tanpa detail internal/secret */}
                    {sig.last_error && (
                      <div className="rounded-xl bg-danger-50 p-3" role="alert">
                        <p className="text-xs font-medium text-danger-700">
                          Permintaan sebelumnya gagal
                        </p>
                        <p className="mt-1 text-xs text-danger-600">
                          Periksa status terbaru. Retry tersedia bila status FAILED
                          atau EXPIRED.
                        </p>
                      </div>
                    )}

                    {/* Satu jalur download resmi lewat service adapter. */}
                    {statusView.canDownload && sig.document_id && (
                      <div className="rounded-xl border border-success-200 bg-success-50 p-3">
                        <Can action="documents.download-signed">
                          <SignedPdfButton
                            documentId={sig.document_id}
                            canDownload
                            compact
                          />
                        </Can>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {retryTarget && (
        <RetrySignatureDialog
          open
          oldRequestId={retryTarget.id}
          status={retryTarget.status}
          busy={retryingId === retryTarget.id}
          error={retryError}
          onClose={() => setRetryTarget(null)}
          onConfirm={() => void confirmRetry()}
        />
      )}
    </div>
  );
}
