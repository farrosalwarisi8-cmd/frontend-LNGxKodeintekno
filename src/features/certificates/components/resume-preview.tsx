"use client";

import { Badge } from "@/shared/components/design-system/badge";
import { PreviewNotice } from "@/features/certificates/components/preview-notice";
import { SignaturePlaceholder } from "@/features/certificates/components/signature-placeholder";
import type { ResumeModel } from "@/features/certificates/resume-model";
import { formatDate } from "@/lib/format";

/**
 * A3 — Pratinjau Resume MCU.
 *
 * Struktur dibuat dari data API (identitas minimum, ringkasan hasil, keputusan
 * FTW, restriksi). Tidak ada nilai yang dihitung di frontend.
 */
export function ResumePreview({ model }: { model: ResumeModel }) {
  return (
    <article data-testid="resume-preview">
      <PreviewNotice />

      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          PT Layar Nusantara Gas — Occupational Health
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Resume Medical Check-Up</h2>
        <p className="mt-1 text-sm text-slate-600">Nomor MCU: {model.mcuNumber}</p>
      </header>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Identitas</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {model.identity.map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="text-sm text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Ringkasan hasil pemeriksaan</h3>
        {model.results.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Nilai hasil perhitungan belum tersedia dari API untuk siklus ini.
          </p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th scope="col" className="py-1 pr-3 font-medium">Parameter</th>
                <th scope="col" className="py-1 pr-3 font-medium">Nilai</th>
                <th scope="col" className="py-1 font-medium">Satuan</th>
              </tr>
            </thead>
            <tbody>
              {model.results.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="py-1 pr-3 text-slate-900">{row.label}</td>
                  <td className="py-1 pr-3 text-slate-900">{row.value}</td>
                  <td className="py-1 text-slate-600">{row.unit ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Keputusan Fitness to Work</h3>
        <p className="mt-2 text-sm text-slate-900">
          {model.decision.ftwLabel}
          {model.decision.decidedAt ? ` · ${formatDate(model.decision.decidedAt)}` : ""}
        </p>
        {model.decision.summary ? (
          <p className="mt-1 text-sm text-slate-700">{model.decision.summary}</p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Ringkasan keputusan belum tersedia dari API.</p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-slate-900">Restriksi kerja</h3>
        {model.restrictions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Tidak ada restriksi kerja tercatat.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {model.restrictions.map((restriction) => (
              <li key={restriction.id} className="text-sm text-slate-800">
                <span className="font-medium">{restriction.description}</span>
                <span className="text-slate-600">
                  {restriction.effectiveDate ? ` · berlaku ${restriction.effectiveDate}` : ""}
                  {restriction.reviewDate ? ` · review ${restriction.reviewDate}` : ""}
                </span>
                {restriction.status ? (
                  <Badge variant="outline" className="ml-2">
                    {restriction.status}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-600">
        <p>
          Status dokumen: <span className="font-medium text-slate-800">{model.document.statusLabel}</span>
        </p>
        <p>
          Versi dokumen: {model.document.version ? formatDate(model.document.version) : "tidak tersedia dari API"}
          {model.document.hash ? ` · hash ${model.document.hash}` : ""}
        </p>
      </section>

      <SignaturePlaceholder />
    </article>
  );
}
