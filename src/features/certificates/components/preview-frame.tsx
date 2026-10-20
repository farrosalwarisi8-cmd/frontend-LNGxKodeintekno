"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import printStyles from "@/features/certificates/preview-print.module.css";

/**
 * A3 — Bingkai pratinjau dokumen (resume MCU / sertifikat FTW / sertifikat D&A).
 *
 * - Pratinjau TIDAK pernah menghasilkan dokumen final. Cetak memakai dialog
 *   cetak browser; area tanda tangan & QR sengaja dikosongkan (diisi pada
 *   tahap TTE/A4).
 * - `data-print-area` menandai bagian yang ikut tercetak; sisanya disembunyikan
 *   oleh stylesheet cetak (lihat `preview-print.module.css`).
 */
export function PreviewFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-50 overflow-y-auto bg-slate-100 print:static print:overflow-visible print:bg-white ${printStyles.printRoot ?? ""}`}
    >
      <div className="mx-auto max-w-3xl p-4 print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Cetak pratinjau
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="size-3.5" />
              Tutup
            </Button>
          </div>
        </div>
        <div
          data-print-area
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
