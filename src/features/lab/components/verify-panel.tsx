"use client";

/**
 * Layar verifikasi analis lab — Fase A2 (Tugas 5).
 *
 * - Meninjau SEMUA hasil sebuah order, menyorot nilai abnormal HANYA dari
 *   `abnormal_flag` API (ikon + teks "Di luar rentang" — bukan warna saja).
 * - Aksi "Verifikasi" di balik permission `verify-lab-result` (khusus role
 *   analis lab) dengan konfirmasi + komentar.
 * - Setelah `verified_at` terisi: hasil terkunci (read-only) dan status
 *   "Terverifikasi, menunggu tanda tangan" — batas akhir alur A2 (TTE = A4).
 * - Koreksi hanya lewat addendum (alur addendum = Fase A4; di sini hanya
 *   penjelasan read-only).
 */

import { useState } from "react";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { Card } from "@/shared/components/design-system/card";
import { Modal } from "@/shared/components/design-system/modal";
import { Input } from "@/shared/components/design-system/input";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { Can } from "@/components/can";
import {
  diagnosticService,
  type BackendLabOrder,
  type BackendLabResult,
} from "@/lib/services/diagnostic.service";
import { formatDateTime } from "@/lib/format";
import { resultValueText } from "@/features/lab/order-utils";
import { LabStatusBadge } from "@/features/lab/components/lab-status-badge";
import { labResultStatusInfo } from "@/features/lab/status-map";

export function VerifyPanel({
  order,
  results,
  onVerified,
}: {
  order: BackendLabOrder;
  results: BackendLabResult[];
  onVerified: () => void;
}) {
  const [target, setTarget] = useState<BackendLabResult | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Belum ada hasil untuk diverifikasi"
        description="Masukkan hasil analisis terlebih dahulu, lalu verifikasi di sini."
      />
    );
  }

  const itemName = (result: BackendLabResult) => {
    const item = (order.order_items ?? []).find((i) => i.id === result.lab_order_item_id);
    return item?.test_type?.name ?? item?.lab_test_type_id ?? result.lab_order_item_id;
  };

  const confirmVerify = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await diagnosticService.verifyLabResult(target.id, comment.trim() || undefined);
      setTarget(null);
      setComment("");
      onVerified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memverifikasi hasil.");
    } finally {
      setSaving(false);
    }
  };

  const abnormalCount = results.reduce(
    (n, r) => n + (r.values ?? []).filter((v) => v.abnormal_flag).length,
    0
  );

  return (
    <div className="space-y-4">
      {abnormalCount > 0 && (
        <p
          className="flex items-center gap-2 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700"
          role="status"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {abnormalCount} nilai ditandai di luar rentang menurut data API — tinjau sebelum
          verifikasi.
        </p>
      )}

      {results.map((result) => {
        const info = labResultStatusInfo(result.status, result.verified_at);
        const locked = Boolean(result.verified_at);
        return (
          <Card key={result.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{itemName(result)}</h3>
                <p className="font-mono text-xs text-slate-500">{result.id}</p>
              </div>
              <LabStatusBadge info={info} />
            </div>

            <table className="w-full text-sm">
              <caption className="sr-only">
                Nilai hasil {itemName(result)} yang akan diverifikasi
              </caption>
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th scope="col" className="py-2">Parameter</th>
                  <th scope="col" className="py-2">Nilai</th>
                  <th scope="col" className="py-2">Satuan</th>
                  <th scope="col" className="py-2">Penandaan (API)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(result.values ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 font-medium text-slate-800">{v.parameter_name}</td>
                    <td className="py-2 font-mono text-slate-700">{resultValueText(v)}</td>
                    <td className="py-2 text-slate-600">{v.unit ?? "—"}</td>
                    <td className="py-2">
                      {v.abnormal_flag ? (
                        <span className="inline-flex items-center gap-1 font-medium text-danger-600">
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          Di luar rentang
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {locked ? (
              <div className="flex flex-col gap-1 rounded-xl border border-info-200 bg-info-50 px-3 py-2 text-sm text-info-700">
                <span className="flex items-center gap-2 font-medium">
                  <Lock className="size-4" aria-hidden="true" />
                  Hasil terkunci · diverifikasi {formatDateTime(result.verified_at ?? undefined)}
                </span>
                <span>
                  Status: Terverifikasi, menunggu tanda tangan. Hasil tidak dapat diedit;
                  koreksi dilakukan lewat addendum (alur addendum dikerjakan Fase A4).
                </span>
                {result.verified_by && (
                  <span className="font-mono text-xs">Penverifik: {result.verified_by}</span>
                )}
              </div>
            ) : (
              <div className="flex justify-end">
                <Can action="lab.verify">
                  <Button
                    type="button"
                    onClick={() => {
                      setTarget(result);
                      setError(null);
                      setComment("");
                    }}
                  >
                    <ShieldCheck className="size-4" aria-hidden="true" /> Verifikasi hasil ini
                  </Button>
                </Can>
              </div>
            )}
          </Card>
        );
      })}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Konfirmasi verifikasi hasil"
        description="Pastikan seluruh nilai sudah ditinjau. Setelah diverifikasi, hasil terkunci dan menunggu tanda tangan."
      >
        <div className="space-y-3">
          <Input
            label="Komentar verifikasi (opsional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Catatan untuk peninjau berikutnya"
            disabled={saving}
          />
          {error && (
            <p className="text-sm text-danger-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Batal
            </Button>
            <Button type="button" onClick={confirmVerify} disabled={saving}>
              {saving ? "Memverifikasi..." : "Ya, verifikasi"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
