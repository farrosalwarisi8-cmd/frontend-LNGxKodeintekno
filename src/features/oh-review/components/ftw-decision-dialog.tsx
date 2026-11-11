"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { Textarea } from "@/features/oh-review/components/textarea";
import {
  FTW_CATEGORIES,
  deviationReasonHint,
  ftwLabel,
  requiresDeviationReason,
  validateFtwForm,
  type FtwCategory,
} from "@/features/oh-review/ftw";
import { Info, TriangleAlert } from "lucide-react";

export interface FtwDecisionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Nama siklus MCU (nomor MCU) untuk judul dialog. */
  mcuNumber: string;
  /** Saran FTW dari sistem (hanya bila API mengirimkannya). */
  suggested: FtwCategory | null;
  /** Catatan dokter (draf) yang ikut dikirim sebagai ringkasan. */
  notes: string;
  /** Status siklus saat ini (untuk menentukan boleh/tidaknya penetapan). */
  locked: boolean;
  onSubmit: (input: {
    ftwStatus: FtwCategory;
    reason: string;
    notes: string;
    restriction?: { description: string; reviewDate: string; supervisor?: string; controls?: string };
  }) => Promise<void>;
}

/**
 * A3 — Penetapan FTW oleh Dokter OH.
 *
 * - Saran sistem ditampilkan apa adanya dari API (bila ada).
 * - Alasan deviasi WAJIB bila pilihan berbeda dari saran sistem.
 * - Ringkasan sebelum final + dialog konfirmasi.
 */
export function FtwDecisionDialog({
  open,
  onClose,
  mcuNumber,
  suggested,
  notes,
  locked,
  onSubmit,
}: FtwDecisionDialogProps) {
  const [chosen, setChosen] = useState<FtwCategory | null>(null);
  const [reason, setReason] = useState("");
  const [restrictionDescription, setRestrictionDescription] = useState("");
  const [restrictionReviewDate, setRestrictionReviewDate] = useState("");
  const [restrictionSupervisor, setRestrictionSupervisor] = useState("");
  const [restrictionControls, setRestrictionControls] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(
    () =>
      validateFtwForm({
        chosen,
        suggested,
        reason,
        restrictionDescription,
        restrictionReviewDate,
      }),
    [chosen, suggested, reason, restrictionDescription, restrictionReviewDate]
  );

  const reasonRequired = requiresDeviationReason(suggested, chosen);

  const handleConfirm = async () => {
    if (!validation.valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ftwStatus: chosen as FtwCategory,
        reason: reason.trim(),
        notes,
        restriction:
          chosen === "FIT_WITH_RESTRICTION"
            ? {
                description: restrictionDescription.trim(),
                reviewDate: restrictionReviewDate.trim(),
                supervisor: restrictionSupervisor.trim() || undefined,
                controls: restrictionControls.trim() || undefined,
              }
            : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan penetapan FTW.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={confirming ? "Konfirmasi penetapan FTW" : "Tetapkan status FTW"}
      description={mcuNumber}
      size="lg"
    >
      <div className="space-y-4">
        {locked && (
          <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Siklus ini sudah memiliki keputusan FTW. Penetapan baru akan menggantikan
              keputusan lama dan tidak dapat dibatalkan; koreksi dilakukan lewat addendum (A4).
            </span>
          </div>
        )}

        {!confirming ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-800">Saran sistem</p>
              <p className="mt-1">
                {suggested ? (
                  <Badge variant="info">{ftwLabel(suggested)}</Badge>
                ) : (
                  <span data-testid="ftw-suggestion-missing">
                    Saran sistem belum tersedia dari API — backend belum menyediakan field saran FTW.
                  </span>
                )}
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Kategori FTW</legend>
              {FTW_CATEGORIES.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="ftw-category"
                    value={option.value}
                    checked={chosen === option.value}
                    onChange={() => setChosen(option.value)}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="font-medium text-slate-900">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-1.5">
              <Textarea
                label={reasonRequired ? "Alasan deviasi (wajib)" : "Alasan deviasi (opsional)"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required={reasonRequired}
                helper={deviationReasonHint(suggested, chosen)}
              />
            </div>

            {chosen === "FIT_WITH_RESTRICTION" && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-700">Detail pembatasan kerja</p>
                <Input
                  label="Deskripsi pembatasan"
                  value={restrictionDescription}
                  onChange={(e) => setRestrictionDescription(e.target.value)}
                />
                <Input
                  label="Tanggal review"
                  type="date"
                  value={restrictionReviewDate}
                  onChange={(e) => setRestrictionReviewDate(e.target.value)}
                />
                <Input
                  label="Supervisor (opsional)"
                  value={restrictionSupervisor}
                  onChange={(e) => setRestrictionSupervisor(e.target.value)}
                />
                <Input
                  label="Kontrol (opsional)"
                  value={restrictionControls}
                  onChange={(e) => setRestrictionControls(e.target.value)}
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Batal
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={!validation.valid}
                data-testid="ftw-review-summary"
              >
                Lanjut ke ringkasan
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-medium text-slate-900">Ringkasan sebelum final</p>
              <dl className="space-y-1">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Kategori FTW</dt>
                  <dd className="font-medium text-slate-900">{ftwLabel(chosen)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Saran sistem</dt>
                  <dd className="text-slate-900">
                    {suggested ? ftwLabel(suggested) : "tidak tersedia dari API"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Alasan deviasi</dt>
                  <dd className="text-right text-slate-900">{reason.trim() || "—"}</dd>
                </div>
                {chosen === "FIT_WITH_RESTRICTION" && (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Pembatasan</dt>
                      <dd className="text-right text-slate-900">{restrictionDescription}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Tanggal review</dt>
                      <dd className="text-slate-900">{restrictionReviewDate}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Catatan dokter</dt>
                  <dd className="text-right text-slate-900">{notes.trim() || "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Setelah ditetapkan, keputusan terkunci di layar ini dan hanya dapat dikoreksi lewat
                addendum (A4).
              </span>
            </div>

            {error && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                Kembali
              </Button>
              <Button onClick={handleConfirm} loading={busy} data-testid="ftw-confirm">
                Ya, tetapkan FTW
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
