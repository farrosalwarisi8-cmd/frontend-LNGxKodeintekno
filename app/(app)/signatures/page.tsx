"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useRef, useState } from "react";
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
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  PENDING: "warning",
  PROCESSING: "info",
  SIGNED: "success",
  FAILED: "danger",
  EXPIRED: "danger",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  SIGNED: CheckCircle,
  FAILED: XCircle,
  EXPIRED: AlertTriangle,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu",
  PROCESSING: "Diproses",
  SIGNED: "Tertandatangani",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
};

const SIGNATURE_TYPE_LABEL: Record<string, string> = {
  CERTIFIED_PSRE: "PSrE Tersertifikasi",
  DIGITAL: "Digital Sederhana",
};

export default function SignaturesPage() {
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Polling untuk status PENDING/PROCESSING
  const [polling, setPolling] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
      setError(e instanceof Error ? e.message : "Gagal memuat data tanda tangan.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Auto-polling setiap 5 detik untuk PENDING/PROCESSING
  useEffect(() => {
    if (!polling) return;
    const hasActive = signatures.some(
      (s) => s.status === "PENDING" || s.status === "PROCESSING"
    );
    if (!hasActive) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }
    if (!pollingRef.current) {
      pollingRef.current = setInterval(() => {
        void load(false);
      }, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [polling, signatures, load]);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    setRetryError(null);
    try {
      await documentService.retrySignature(id);
      setMsg("Retry berhasil. Status akan diperbarui otomatis.");
      await load(false);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Gagal retry signature.");
    } finally {
      setRetryingId(null);
    }
  };

  const [msg, setMsg] = useState<string | null>(null);

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
    (s) => s.status === "PENDING" || s.status === "PROCESSING"
  ).length;
  const signedCount = signatures.filter((s) => s.status === "SIGNED").length;
  const failedCount = signatures.filter(
    (s) => s.status === "FAILED" || s.status === "EXPIRED"
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Tanda Tangan Elektronik
          </h1>
          <p className="text-sm text-muted-foreground">
            Tracking semua signature request PSrE/PTTE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPolling((p) => !p)}
            disabled={!pendingCount}
          >
            <RefreshCw className={`size-4 ${polling && pendingCount > 0 ? "animate-spin" : ""}`} />
            {polling ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700">{msg}</div>
      )}
      {retryError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
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
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari ID dokumen / provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
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
            const canRetry =
              (sig.status === "FAILED" || sig.status === "EXPIRED") &&
              retryingId !== sig.id;
            const isPolling =
              sig.status === "PENDING" || sig.status === "PROCESSING";

            return (
              <Card key={sig.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        sig.status === "SIGNED"
                          ? "bg-success-100 text-success-600"
                          : sig.status === "FAILED" || sig.status === "EXPIRED"
                            ? "bg-danger-100 text-danger-600"
                            : "bg-warning-100 text-warning-600"
                      }`}
                    >
                      {(() => {
                        const Icon = STATUS_ICON[sig.status] ?? Clock;
                        return <Icon className={`size-5 ${isPolling ? "animate-spin" : ""}`} />;
                      })()}
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
                        <Badge variant={STATUS_VARIANT[sig.status] ?? "default"}>
                          {STATUS_LABEL[sig.status] ?? sig.status}
                        </Badge>
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
                    <Can action="documents.request-signature">
                      {canRetry && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(sig.id)}
                          disabled={retryingId === sig.id}
                        >
                          <RefreshCw className="size-3.5" />
                          {retryingId === sig.id ? "Retrying..." : "Retry"}
                        </Button>
                      )}
                    </Can>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(isExpanded ? null : sig.id)}
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

                    {/* Error info */}
                    {sig.last_error && (
                      <div className="rounded-xl bg-danger-50 p-3">
                        <p className="text-xs font-medium text-danger-700">Error:</p>
                        <p className="mt-1 text-xs text-danger-600">{sig.last_error}</p>
                      </div>
                    )}

                    {/* Signed document download */}
                    {sig.status === "SIGNED" && sig.document_id && (
                      <div className="rounded-xl border border-success-200 bg-success-50 p-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-success-600" />
                          <p className="text-xs font-medium text-success-700">
                            Dokumen sudah tertandatangani — siap download
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            window.open(
                              `/api/v1/documents/${sig.document_id}/download`,
                              "_blank",
                              "noopener"
                            );
                          }}
                        >
                          Download Signed PDF
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
