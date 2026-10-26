"use client";

import { Modal } from "@/components/ui/modal";
import { FileCheck2, Clock3 } from "lucide-react";

export interface EmailPreviewProps {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  recipientEmail: string;
  consentLink: string;
}

export function EmailPreview({ open, onClose, recipientName, recipientEmail, consentLink }: EmailPreviewProps) {
  return (
    <Modal open={open} onClose={onClose} title="Preview Email Consent" description="Simulated email preview — tidak mengirim email sungguhan." size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted p-4">
          <div className="space-y-1 text-sm">
            <p><span className="font-medium text-text-secondary">To:</span> <span className="text-text-secondary">{recipientEmail}</span></p>
            <p><span className="font-medium text-text-secondary">Subject:</span> <span className="text-text-secondary">Persetujuan data EMR</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-border p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
            <FileCheck2 className="size-4 text-primary-600" />
            PT Layar Nusantara Gas
          </div>

          <div className="space-y-4 text-sm text-text-secondary">
            <p>Halo {recipientName},</p>
            <p>
              Kami membutuhkan persetujuan Anda untuk pemrosesan data kesehatan sesuai kebijakan perusahaan.
            </p>
            <p>
              Silakan klik tombol di bawah ini untuk membuka halaman consent:
            </p>
            <div className="flex justify-center">
              <a
                href={consentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Buka halaman consent
              </a>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-warning-50 p-3 text-xs text-warning-600">
              <Clock3 className="size-4 shrink-0" />
              {/* Masa berlaku mengikuti backend (consent.PENDING expired_at = 7 hari). */}
              <span>Link berlaku sampai 7 hari.</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Simulated email preview — tidak mengirim email sungguhan.
        </p>
      </div>
    </Modal>
  );
}
