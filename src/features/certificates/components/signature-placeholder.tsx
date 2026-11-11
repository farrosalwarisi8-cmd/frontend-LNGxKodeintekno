"use client";

import { QrCode, Signature } from "lucide-react";

/**
 * A3 — Area tanda tangan & QR pada pratinjau dokumen.
 *
 * Area INI SENGAJA KOSONG: penandatanganan, QR, dan hash adalah milik tahap
 * TTE (A4). A3 tidak pernah membuat tanda tangan, QR, atau hash.
 */
export function SignaturePlaceholder({
  signerLabel = "Dokter OH",
}: {
  signerLabel?: string;
}) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div
        data-testid="signature-placeholder"
        className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-center"
      >
        <Signature className="size-5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Area tanda tangan dan QR (diisi pada tahap TTE)</p>
        <p className="text-[11px] text-muted-foreground">{signerLabel} · belum ditandatangani</p>
      </div>
      <div
        data-testid="qr-placeholder"
        className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-center"
      >
        <QrCode className="size-5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Area QR verifikasi (diisi pada tahap TTE)</p>
        <p className="text-[11px] text-muted-foreground">Token QR belum tersedia</p>
      </div>
    </div>
  );
}
