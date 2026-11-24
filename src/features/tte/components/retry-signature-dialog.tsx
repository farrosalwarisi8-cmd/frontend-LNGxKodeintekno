"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Modal } from "@/shared/components/design-system/modal";
import { Button } from "@/shared/components/design-system/button";
import { maskId } from "@/features/tte/mask";

/**
 * Konfirmasi retry. Retry backend tidak punya endpoint khusus — ia membuat
 * signature request BARU untuk dokumen yang sama. UI menyatakan ini eksplisit
 * supaya retry tidak disamarkan sebagai kelanjutan request lama.
 */
export function RetrySignatureDialog({
  open,
  oldRequestId,
  status,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  oldRequestId: string;
  status: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Konfirmasi Retry Tanda Tangan"
      description="Permintaan baru akan diterbitkan untuk dokumen yang sama."
      size="sm"
    >
      <div className="space-y-4">
        <dl className="space-y-2 rounded-xl border border-border p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Request lama</dt>
            <dd className="font-mono text-foreground" title="ID disamarkan">
              {maskId(oldRequestId)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status lama</dt>
            <dd className="font-medium text-foreground">{status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Request baru</dt>
            <dd className="font-medium text-foreground">Akan dibuat setelah konfirmasi</dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          ID request ditampilkan dalam bentuk tersamarkan; ID lengkap tetap
          tersedia pada audit trail backend.
        </p>

        <div className="flex gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Retry membuat <strong>request ID baru</strong>; request lama tidak
            dilanjutkan. Retry tidak dilakukan otomatis tanpa batas — lakukan hanya
            bila Anda masih memerlukan tanda tangan untuk dokumen ini.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11">
            Batal
          </Button>
          <Button onClick={onConfirm} disabled={busy} loading={busy} className="min-h-11">
            <RefreshCw className="size-4" aria-hidden="true" />
            {busy ? "Membuat request..." : "Buat Request Baru"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
