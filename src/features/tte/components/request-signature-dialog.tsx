"use client";

import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Modal } from "@/shared/components/design-system/modal";
import { Button } from "@/shared/components/design-system/button";
import { Select } from "@/shared/components/design-system/select";
import {
  BACKEND_SIGNATURE_TYPES,
  SIGNATURE_TYPE_LABEL,
  type BackendSignatureType,
} from "@/features/tte/validation";

export interface SignatureDocumentMeta {
  /** ID baris dokumen di UI (untuk memperbarui state setelah request). */
  recordId: string;
  /** ID dokumen backend yang dikirim ke POST /signatures/request. */
  id: string;
  title: string;
  documentType: string;
  createdAt?: string;
  status?: string;
  objectKey?: string;
  sizeBytes?: number | null;
  signerName?: string | null;
  signerEmail?: string | null;
  providerCode?: string | null;
}

/**
 * Konfirmasi eksplisit sebelum POST /signatures/request.
 *
 * Yang ditampilkan hanya metadata dokumen yang tersedia dari kontrak backend.
 * Tidak ada API key, callback secret, callback URL internal, atau credential
 * penanda tangan yang pernah muncul di sini.
 */
export function RequestSignatureDialog({
  document,
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  document: SignatureDocumentMeta;
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (signatureType: BackendSignatureType) => void;
}) {
  const [signatureType, setSignatureType] =
    useState<BackendSignatureType>("CERTIFIED_PSRE");

  const size =
    typeof document.sizeBytes === "number"
      ? `${(document.sizeBytes / 1024 / 1024).toFixed(2)} MB`
      : "Tidak tersedia dari backend";

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Konfirmasi Permintaan Tanda Tangan"
      description="Periksa ringkasan dokumen sebelum mengirim permintaan ke backend."
      size="md"
    >
      <div className="space-y-4">
        <dl className="space-y-2 rounded-xl border border-border p-3 text-sm">
          <Row label="Judul dokumen" value={document.title} />
          <Row label="Jenis dokumen" value={document.documentType} />
          <Row label="Ukuran file" value={size} />
          <Row label="Status dokumen" value={document.status ?? "Tidak diketahui"} />
          <Row
            label="Penanda tangan"
            value={
              document.signerName || document.signerEmail
                ? [document.signerName, document.signerEmail].filter(Boolean).join(" · ")
                : "Tidak tersedia dari backend"
            }
          />
          <Row
            label="Provider"
            value={document.providerCode ?? "Ditentukan backend"}
          />
        </dl>

        <div className="flex gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Dokumen ini akan dikirim ke provider TTE <strong>melalui backend</strong>.
            Browser tidak mengirim data langsung ke provider, tidak menyimpan secret,
            dan tidak mengunggah berkas ke alamat eksternal. Backend memvalidasi PDF
            maksimal 15 MB, content type, dan struktur berkas.
          </p>
        </div>

        <Select
          label="Jenis Tanda Tangan"
          value={signatureType}
          onChange={(e) => setSignatureType(e.target.value as BackendSignatureType)}
          options={BACKEND_SIGNATURE_TYPES.map((type) => ({
            value: type,
            label: SIGNATURE_TYPE_LABEL[type],
          }))}
          helper="Nilai ini harus merupakan enum yang diterima backend."
          disabled={busy}
        />

        {error && (
          <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11">
            Batal
          </Button>
          <Button
            onClick={() => onConfirm(signatureType)}
            disabled={busy}
            loading={busy}
            className="min-h-11"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            {busy ? "Mengirim..." : "Kirim Permintaan TTE"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          Satu klik mengirim satu permintaan. Tombol dinonaktifkan saat permintaan
          sedang diproses.
        </p>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground break-words">{value || "—"}</dd>
    </div>
  );
}
