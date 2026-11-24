"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { documentService } from "@/lib/services/document.service";
import { mapTteError, type TteErrorView } from "@/features/tte/error-mapping";

/**
 * Tombol unduh signed PDF — satu-satunya jalur unduhan yang dipakai UI.
 *
 * - Hanya dirender bila status benar-benar SIGNED / backend memberi izin.
 * - URL divalidasi oleh adapter service sebelum dibuka; tidak ada provider PSP
 *   yang dipanggil langsung, tidak ada token yang dicatat ke console/analytics.
 * - Loading, error, dan retry tersedia; error memakai pesan aman.
 */
export function SignedPdfButton({
  documentId,
  title,
  canDownload,
  compact = false,
}: {
  documentId: string;
  title?: string;
  canDownload: boolean;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TteErrorView | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  if (!canDownload || !documentId) return null;

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url } = await documentService.downloadDocument(documentId, title);
      if (!aliveRef.current) return;
      // URL sudah divalidasi adapter service (https, tanpa credential, berasal
      // dari response backend). Navigasi memakai anchor agar tetap dapat
      // dilakukan meski browser memblokir window.open setelah await.
      setReadyUrl(url);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      if (aliveRef.current) setError(mapTteError(e));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        size={compact ? "sm" : "md"}
        variant="outline"
        onClick={() => void handleDownload()}
        disabled={loading}
        loading={loading}
        className="min-h-11"
        aria-label={`Unduh PDF bertanda tangan untuk ${title ?? documentId}`}
      >
        <Download className="size-3.5" aria-hidden="true" />
        {loading ? "Menyiapkan berkas..." : "Unduh Signed PDF"}
      </Button>
      {!loading && error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-2" role="alert">
          <p className="text-xs font-medium text-danger-700">{error.title}</p>
          <p className="mt-0.5 text-xs text-danger-600">{error.message}</p>
          {error.retryable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleDownload()}
              className="mt-1 min-h-11"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Coba lagi
            </Button>
          )}
        </div>
      )}
      {!loading && readyUrl && !error && (
        <p className="text-xs text-muted-foreground" role="status">
          Berkas dibuka di tab baru.{" "}
          <a
            href={readyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 underline underline-offset-2"
          >
            Buka manual bila tab tidak muncul
          </a>
          .
        </p>
      )}
      {!error && !readyUrl && (
        <p className="flex items-center gap-1 text-xs text-success-700" role="status">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Berkas tersedia setelah backend menandatangani PDF.
        </p>
      )}
    </div>
  );
}
