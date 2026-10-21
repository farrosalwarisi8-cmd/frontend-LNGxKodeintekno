"use client";

/**
 * Form laporan radiologi — Fase A2 (Tugas 7).
 *
 * - Temuan (`findings`) & kesimpulan (`impression`) dari form, sesuai
 *   kontrak `POST /diagnostic/radiology-results`.
 * - Draf disimpan lokal per order (offline-safe); kirim + status jelas.
 * - Lampiran gambar/PDF: field `files[{objectKey, sha256Hash}]` ada di
 *   kontrak TETAPI tidak ada endpoint upload yang menghasilkan `objectKey`
 *   di klien API repo ini → BLOCKER BACKEND; UI menampilkan alasan, tidak
 *   memalsukan upload.
 * - Hasil yang sudah `verified_at`/dikirim tampil read-only (koreksi =
 *   addendum, Fase A4).
 */

import { useEffect, useState } from "react";
import { Lock, Paperclip, Send } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { Card } from "@/shared/components/design-system/card";
import {
  diagnosticService,
  type BackendRadiologyResult,
} from "@/lib/services/diagnostic.service";
import { formatDateTime } from "@/lib/format";

export interface RadiologyOrderDetail {
  id: string;
  encounter_id?: string | null;
  modality: string;
  body_part: string;
  status: string;
  ordered_at: string;
  ordered_by?: string | null;
  radiology_result?: BackendRadiologyResult | null;
}

const draftKey = (orderId: string) => `kodein_radiology_draft__${orderId}`;

function readDraft(orderId: string): { findings: string; impression: string } | null {
  try {
    const raw = localStorage.getItem(draftKey(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.findings !== "string" || typeof parsed?.impression !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function RadiologyReportForm({
  order,
  onSubmitted,
}: {
  order: RadiologyOrderDetail;
  onSubmitted: () => void;
}) {
  const existing = order.radiology_result ?? null;
  const [findings, setFindings] = useState(existing?.findings ?? "");
  const [impression, setImpression] = useState(existing?.impression ?? "");
  const [draftNotice, setDraftNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulihkan draf sekali per order (hanya bila belum ada hasil tersimpan).
  // Defer ke callback — konsisten dengan pola repo (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (existing) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const draft = readDraft(order.id);
      if (!draft) return;
      if (!draft.findings && !draft.impression) return;
      setFindings(draft.findings);
      setImpression(draft.impression);
      setDraftNotice(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order.id, existing]);

  const persistDraft = (next: { findings: string; impression: string }) => {
    try {
      localStorage.setItem(draftKey(order.id), JSON.stringify(next));
    } catch {
      // storage diblokir — bukan alasan gagal
    }
  };

  if (existing) {
    return (
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Laporan tersimpan</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-100 px-2.5 py-0.5 text-xs font-medium text-info-600">
            {existing.verified_at ? (
              <>
                <Lock className="size-3" aria-hidden="true" /> Terverifikasi, menunggu tanda
                tangan
              </>
            ) : (
              "Laporan terkirim"
            )}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Temuan</p>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{existing.findings || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Kesimpulan</p>
          <p className="whitespace-pre-wrap text-sm text-slate-800">{existing.impression || "—"}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="size-3.5" aria-hidden="true" />
          Laporan tidak dapat diedit langsung — koreksi dilakukan lewat addendum (alur addendum
          dikerjakan Fase A4).
        </p>
        {existing.verified_at && (
          <p className="text-xs text-slate-500">
            Diverifikasi {formatDateTime(existing.verified_at)}
            {existing.verified_by ? ` oleh ${existing.verified_by}` : ""}
          </p>
        )}
      </Card>
    );
  }

  const submit = async () => {
    if (!findings.trim() || !impression.trim()) {
      setError("Temuan dan kesimpulan wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await diagnosticService.submitRadiologyResult({
        radiologyOrderId: order.id,
        findings: findings.trim(),
        impression: impression.trim(),
      });
      try {
        localStorage.removeItem(draftKey(order.id));
      } catch {
        // abaikan
      }
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan laporan radiologi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Susun laporan radiologi</h3>
        <span className="text-xs text-slate-500">
          {order.modality} · {order.body_part} · <span className="font-mono">{order.id}</span>
        </span>
      </div>

      {draftNotice && (
        <p className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          Draf tersimpan sebelumnya dipulihkan.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="rad-findings" className="block text-sm font-medium text-slate-700">
          Temuan (findings)
        </label>
        <textarea
          id="rad-findings"
          value={findings}
          onChange={(e) => {
            setFindings(e.target.value);
            persistDraft({ findings: e.target.value, impression });
          }}
          rows={5}
          disabled={saving}
          aria-required="true"
          aria-invalid={error && !findings.trim() ? true : undefined}
          aria-describedby={error && !findings.trim() ? "rad-report-error" : undefined}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50"
          placeholder="Deskripsi temuan radiologis..."
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rad-impression" className="block text-sm font-medium text-slate-700">
          Kesimpulan (impression)
        </label>
        <textarea
          id="rad-impression"
          value={impression}
          onChange={(e) => {
            setImpression(e.target.value);
            persistDraft({ findings, impression: e.target.value });
          }}
          rows={4}
          disabled={saving}
          aria-required="true"
          aria-invalid={error && !impression.trim() ? true : undefined}
          aria-describedby={error && !impression.trim() ? "rad-report-error" : undefined}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50"
          placeholder="Kesimpulan/impresi pemeriksaan..."
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Paperclip className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Lampiran gambar/PDF dinonaktifkan: field <code>files</code> membutuhkan{" "}
          <code>objectKey</code> dari endpoint upload yang belum tersedia pada klien API repo ini
          (BLOCKER BACKEND).
        </span>
      </div>

      {error && (
        <p id="rad-report-error" className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => persistDraft({ findings, impression })}
          disabled={saving}
        >
          Simpan draf
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          <Send className="size-4" aria-hidden="true" /> {saving ? "Mengirim..." : "Kirim laporan"}
        </Button>
      </div>
    </Card>
  );
}
