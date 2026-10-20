"use client";

import { PreviewNotice } from "@/features/certificates/components/preview-notice";
import { SignaturePlaceholder } from "@/features/certificates/components/signature-placeholder";
import type { ResumeModel } from "@/features/certificates/resume-model";
import { formatDate } from "@/lib/format";

/**
 * A3 — Pratinjau Sertifikat FTW.
 *
 * Belum sah: penandatanganan, QR, dan hash diisi pada tahap TTE (A4).
 */
export function FtwCertificatePreview({ model }: { model: ResumeModel }) {
  const identity = new Map(model.identity.map((item) => [item.label, item.value]));

  return (
    <article data-testid="ftw-certificate-preview">
      <PreviewNotice />

      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          PT Layar Nusantara Gas
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Sertifikat Kelaikan Kerja (Fitness to Work)
        </h2>
        <p className="mt-1 text-sm text-slate-600">Nomor MCU: {model.mcuNumber}</p>
      </header>

      <section className="mt-6">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[
            { label: "Nama pekerja", value: identity.get("Nama pekerja") },
            { label: "MRN", value: identity.get("MRN") },
            { label: "Nomor pekerja", value: identity.get("Nomor pekerja") },
            { label: "Site", value: identity.get("Site") },
            { label: "Jenis MCU", value: identity.get("Jenis MCU") },
            { label: "Tanggal pemeriksaan", value: identity.get("Tanggal pemeriksaan") },
          ].map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="text-sm text-slate-900">{item.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Status Kelaikan Kerja</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{model.decision.ftwLabel}</p>
        {model.decision.summary ? (
          <p className="mt-1 text-sm text-slate-700">{model.decision.summary}</p>
        ) : null}
        {model.decision.decidedAt ? (
          <p className="mt-1 text-xs text-slate-500">
            Ditetapkan: {formatDate(model.decision.decidedAt)}
          </p>
        ) : null}
      </section>

      {model.restrictions.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">Pembatasan kerja</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
            {model.restrictions.map((restriction) => (
              <li key={restriction.id}>
                {restriction.description}
                {restriction.reviewDate ? ` (review ${restriction.reviewDate})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SignaturePlaceholder />

      <p className="mt-6 text-xs text-slate-500">
        Status dokumen: {model.document.statusLabel}. Dokumen ini belum sah sampai ditandatangani
        pada tahap TTE.
      </p>
    </article>
  );
}
