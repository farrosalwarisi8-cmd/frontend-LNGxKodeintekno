"use client";

import { AlertTriangle } from "lucide-react";

/**
 * A3 — Penanda pratinjau.
 *
 * Pratinjau BELUM SAH. Dokumen sah hanya setelah penandatanganan TTE (A4).
 * Penanda ini selalu tampil (ikon + teks), tidak hanya mengandalkan warna.
 */
export function PreviewNotice({
  title = "PRATINJAU, belum sah",
  description = "Dokumen ini belum ditandatangani dan tidak sah. Area tanda tangan dan QR diisi pada tahap TTE.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      role="note"
      data-testid="preview-notice"
      className="mb-6 flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-600" />
      <div>
        <p className="text-sm font-semibold text-warning-700">{title}</p>
        <p className="mt-1 text-xs text-warning-700">{description}</p>
      </div>
    </div>
  );
}
