"use client";

import { PreviewNotice } from "@/features/certificates/components/preview-notice";
import { SignaturePlaceholder } from "@/features/certificates/components/signature-placeholder";
import type { BackendDaTest } from "@/lib/services/da.service";
import { confirmationResultLabel, screeningResultLabel } from "@/features/dna/results";
import { formatDate } from "@/lib/format";

/**
 * A3 — Pratinjau Sertifikat D&A.
 *
 * Belum sah: penandatanganan, QR, dan hash diisi pada tahap TTE (A4).
 * Pratinjau hanya boleh dibuka setelah hasil ditampilkan secara sadar.
 */
export function DnaCertificatePreview({ test }: { test: BackendDaTest }) {
  const sample = test.samples?.[0];
  const result = test.results?.[0];

  return (
    <article data-testid="dna-certificate-preview">
      <PreviewNotice
        title="PRATINJAU, belum sah"
        description="Sertifikat D&A ini belum ditandatangani dan tidak sah. Area tanda tangan dan QR diisi pada tahap TTE."
      />

      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          PT Layar Nusantara Gas — Occupational Health
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">Sertifikat D&amp;A</h2>
        <p className="mt-1 text-sm text-slate-600">
          Nomor tes: {test.id} · Nomor sampel: {sample?.sample_no ?? "—"}
        </p>
      </header>

      <section className="mt-6">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {[
            { label: "Nama pekerja", value: test.patient?.full_name ?? "—" },
            { label: "MRN", value: test.patient?.medical_record_no ?? "—" },
            { label: "Jenis tes", value: test.test_type ?? "—" },
            { label: "Spesimen", value: sample?.specimen_type ?? "—" },
            { label: "Waktu pengambilan", value: formatDate(test.collected_at ?? "") },
            { label: "Tanggal tes", value: formatDate(test.created_at ?? "") },
          ].map((item) => (
            <div key={item.label} className="flex flex-col">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd className="text-sm text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Hasil pemeriksaan</p>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-xs text-slate-500">Hasil screening</dt>
            <dd className="text-sm text-slate-900">{screeningResultLabel(result?.screening_result)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-slate-500">Hasil konfirmasi</dt>
            <dd className="text-sm text-slate-900">{confirmationResultLabel(result)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Status dokumen: belum tersedia dari API pada pratinjau ini. Dokumen sah hanya setelah
          penandatanganan pada tahap TTE.
        </p>
      </section>

      <SignaturePlaceholder />
    </article>
  );
}
