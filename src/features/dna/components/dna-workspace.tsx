"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { useCan } from "@/components/can";
import { useStore } from "@/lib/store";
import { formatDate, formatDateTime } from "@/lib/format";
import { toastSuccess } from "@/lib/use-toast";
import { appendCustodyEvent, fetchDnaTests, submitDnaResult } from "@/features/dna/api";
import {
  clearDnaSensitiveState,
  getDnaSensitiveState,
  setDnaSensitiveState,
} from "@/features/dna/sensitive-state";
import { REVEAL_PROMPT } from "@/features/dna/access";
import {
  confirmationResultLabel,
  hasConfirmationResult,
  isConfirmed,
  requiresConfirmationTest,
  screeningResultLabel,
} from "@/features/dna/results";
import { toCustodyTimeline } from "@/features/dna/custody";
import { DnaCertificatePreview } from "@/features/dna/components/dna-certificate-preview";
import { PreviewFrame } from "@/features/certificates/components/preview-frame";
import type { BackendDaTest } from "@/lib/services/da.service";
import { Eye, EyeOff, FlaskConical, Info, ShieldCheck } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "REGISTERED", label: "Registered" },
  { value: "SAMPLE_COLLECTED", label: "Sample Collected" },
  { value: "CONFIRMATION_PENDING", label: "Confirmation Pending" },
  { value: "FINALIZED", label: "Finalized" },
  { value: "CANCELLED", label: "Cancelled" },
];

const CUSTODY_ACTIONS = [
  "SAMPLE_COLLECTED_AND_SEALED",
  "HANDED_TO_COURIER",
  "RECEIVED_BY_LAB",
  "ANALYSIS_STARTED",
  "ANALYSIS_COMPLETED",
  "RESULTS_REPORTED",
  "STORED",
  "DISPOSED",
];

/**
 * A3 — Modul D&A (akses terbatas: Dokter OH).
 *
 * - Hasil disembunyikan secara default; hanya tampil setelah tindakan sadar.
 * - Chain of custody hanya-tambah (append-only), tanpa edit/hapus.
 * - Data D&A tidak pernah ditulis ke storage, URL, judul tab, atau toast.
 */
export function DnaWorkspace() {
  const can = useCan();
  const currentUserId = useStore((s) => s.currentUserId);

  const [tests, setTests] = useState<BackendDaTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const [custodyFrom, setCustodyFrom] = useState("");
  const [custodyTo, setCustodyTo] = useState("");
  const [custodyAction, setCustodyAction] = useState("");
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [custodyError, setCustodyError] = useState<string | null>(null);

  const [confirmationValue, setConfirmationValue] = useState("NEGATIVE");
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchDnaTests({ page: 1, limit: 100, status: status || undefined });
      setTests(rows);
      setDnaSensitiveState({ tests: rows, selectedTestId: getDnaSensitiveState().selectedTestId, resultsRevealed: getDnaSensitiveState().resultsRevealed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data D&A.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  // Bersihkan state sensitif saat keluar halaman.
  useEffect(() => {
    return () => {
      clearDnaSensitiveState();
    };
  }, []);

  // Bersihkan state sensitif saat sesi berakhir.
  useEffect(() => {
    if (currentUserId) return;
    clearDnaSensitiveState();
  }, [currentUserId]);

  // Bersihkan state sensitif saat tab ditutup.
  useEffect(() => {
    const handler = () => clearDnaSensitiveState();
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tests;
    return tests.filter((test) =>
      [
        test.patient?.full_name,
        test.patient?.medical_record_no,
        test.id,
        test.test_type,
        ...(test.samples ?? []).map((sample) => sample.sample_no),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [tests, search]);

  const selected = useMemo(
    () => filtered.find((test) => test.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const sample = selected?.samples?.[0] ?? null;
  const custody = useMemo(() => toCustodyTimeline(sample?.custody_chain), [sample]);
  const result = selected?.results?.[0] ?? null;
  const needsConfirmation = requiresConfirmationTest(selected);

  const selectTest = (id: string) => {
    setSelectedId(id);
    setRevealed(false);
    setDnaSensitiveState({ tests, selectedTestId: id, resultsRevealed: false });
  };

  const handleReveal = () => {
    setRevealed(true);
    setDnaSensitiveState({ tests, selectedTestId: selectedId, resultsRevealed: true });
  };

  const handleHide = () => {
    setRevealed(false);
    setDnaSensitiveState({ tests, selectedTestId: selectedId, resultsRevealed: false });
  };

  const handleAddCustody = async () => {
    if (!sample) return;
    if (!custodyFrom.trim() || !custodyTo.trim() || !custodyAction.trim()) {
      setCustodyError("Pelaku pengirim, penerima, dan aksi wajib diisi.");
      return;
    }
    setCustodyBusy(true);
    setCustodyError(null);
    try {
      await appendCustodyEvent(sample.id, {
        fromParty: custodyFrom.trim(),
        toParty: custodyTo.trim(),
        action: custodyAction.trim(),
      });
      setCustodyFrom("");
      setCustodyTo("");
      setCustodyAction("");
      toastSuccess("Kejadian custody dicatat", "Kejadian tersimpan dan tidak dapat diubah.");
      await load();
    } catch (e) {
      setCustodyError(e instanceof Error ? e.message : "Gagal mencatat kejadian custody.");
    } finally {
      setCustodyBusy(false);
    }
  };

  const handleConfirmation = async () => {
    if (!selected || !result) return;
    setConfirmationBusy(true);
    setConfirmationError(null);
    try {
      await submitDnaResult(selected.id, {
        screeningResult: result.screening_result ?? "",
        confirmationResult: confirmationValue,
        confirmed: true,
      });
      toastSuccess("Hasil konfirmasi tersimpan", "Status confirmation test diperbarui di server.");
      await load();
    } catch (e) {
      setConfirmationError(e instanceof Error ? e.message : "Gagal menyimpan hasil konfirmasi.");
    } finally {
      setConfirmationBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">D&amp;A Forensik — Dokter OH</h1>
        <p className="text-sm text-slate-500">
          Sampel, chain of custody, hasil screening, dan confirmation test. Akses terbatas.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Input
              label="Pencarian"
              placeholder="Nama, MRN, nomor sampel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              label="Status tes"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Data D&A tidak disimpan di perangkat, tidak masuk URL, dan tidak ditampilkan pada judul
              tab atau pesan toast. State sensitif dibersihkan saat keluar halaman dan saat sesi
              berakhir.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-4 text-primary-600" />
              Daftar tes D&amp;A
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {!loading && error && (
              <ErrorState
                title="Gagal memuat data D&A"
                message={error}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            )}

            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                icon={FlaskConical}
                title="Belum ada tes D&A"
                description="Tes D&A akan muncul di sini setelah terdaftar di server."
              />
            )}

            {!loading && !error && filtered.length > 0 && (
              <ul className="space-y-2">
                {filtered.map((test) => (
                  <li key={test.id}>
                    <button
                      type="button"
                      onClick={() => selectTest(test.id)}
                      data-testid={`dna-test-${test.id}`}
                      aria-pressed={selectedId === test.id}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        selectedId === test.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {test.patient?.full_name ?? "Nama tidak tersedia dari API"}
                        </span>
                        <Badge variant="outline">{test.status ?? "Status belum tersedia"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {test.patient?.medical_record_no ?? "MRN belum tersedia"} ·{" "}
                        {test.test_type ?? "Jenis tes belum tersedia"} ·{" "}
                        {formatDate(test.created_at ?? "")}
                      </p>
                      {test.samples?.[0]?.sample_no ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Sampel: {test.samples[0].sample_no}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-slate-500">
                  Pilih satu tes D&amp;A untuk melihat sampel, chain of custody, dan hasilnya.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card data-testid="dna-detail">
                <CardHeader>
                  <CardTitle>Detail tes D&amp;A</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {[
                      { label: "Nama pekerja", value: selected.patient?.full_name ?? "—" },
                      { label: "MRN", value: selected.patient?.medical_record_no ?? "—" },
                      { label: "Jenis tes", value: selected.test_type ?? "—" },
                      { label: "Status", value: selected.status ?? "—" },
                      { label: "Waktu pengambilan", value: formatDateTime(selected.collected_at ?? "") },
                      {
                        label: "Sampel",
                        value: sample ? `${sample.sample_no ?? "—"} (${sample.specimen_type ?? "—"})` : "—",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col">
                        <dt className="text-xs text-slate-500">{item.label}</dt>
                        <dd className="text-sm text-slate-900">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary-600" />
                    Chain of custody
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Kejadian bersifat hanya-tambah: tidak ada aksi ubah atau hapus, dan pencatatan
                    baru tidak dapat mengubah kejadian sebelumnya.
                  </p>

                  {custody.length === 0 ? (
                    <p className="text-sm text-slate-500">Belum ada kejadian custody tercatat.</p>
                  ) : (
                    <ol className="space-y-2" data-testid="custody-timeline">
                      {custody.map((entry, index) => (
                        <li key={entry.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {entry.actionLabel}
                            </span>
                            {index === custody.length - 1 ? (
                              <Badge variant="success">Terakhir</Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {entry.fromParty} → {entry.toParty}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {entry.eventAt ? formatDateTime(entry.eventAt) : "Waktu belum tersedia dari API"}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}

                  {can("dna.record-custody") ? (
                    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-700">Tambah kejadian custody</p>
                      <Input
                        label="Dari (pelaku pengirim)"
                        value={custodyFrom}
                        onChange={(e) => setCustodyFrom(e.target.value)}
                      />
                      <Input
                        label="Ke (pelaku penerima)"
                        value={custodyTo}
                        onChange={(e) => setCustodyTo(e.target.value)}
                      />
                      <Input
                        label="Aksi"
                        value={custodyAction}
                        onChange={(e) => setCustodyAction(e.target.value)}
                        list="custody-action-options"
                        placeholder="Pilih atau tulis aksi..."
                      />
                      <datalist id="custody-action-options">
                        {CUSTODY_ACTIONS.map((action) => (
                          <option key={action} value={action} />
                        ))}
                      </datalist>
                      {custodyError && (
                        <p className="text-sm text-danger-600">{custodyError}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddCustody}
                        loading={custodyBusy}
                        data-testid="add-custody-event"
                      >
                        Catat kejadian
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Pencatatan kejadian custody hanya dapat dilakukan oleh Dokter OH.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Hasil screening &amp; confirmation test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!revealed ? (
                    <div className="space-y-3" data-testid="dna-results-hidden">
                      <p className="text-sm text-slate-600">{REVEAL_PROMPT}</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReveal}
                        data-testid="reveal-dna-results"
                      >
                        <Eye className="size-3.5" />
                        Tampilkan hasil
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3" data-testid="dna-results-visible">
                      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        <div className="flex flex-col">
                          <dt className="text-xs text-slate-500">Hasil screening</dt>
                          <dd className="text-sm text-slate-900" data-testid="dna-screening-result">
                            {screeningResultLabel(result?.screening_result)}
                          </dd>
                        </div>
                        <div className="flex flex-col">
                          <dt className="text-xs text-slate-500">Hasil konfirmasi</dt>
                          <dd className="text-sm text-slate-900" data-testid="dna-confirmation-result">
                            {confirmationResultLabel(result)}
                          </dd>
                        </div>
                      </dl>

                      <div className="flex items-center gap-2">
                        <Badge variant={isConfirmed(result) ? "success" : "warning"}>
                          {isConfirmed(result) ? "Sudah dikonfirmasi" : "Belum dikonfirmasi"}
                        </Badge>
                      </div>

                      {needsConfirmation && (
                        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                          <p className="text-sm font-medium text-slate-700">
                            Confirmation test diperlukan
                          </p>
                          <p className="text-xs text-slate-500">
                            Status tes dan hasil screening dari API menunjukkan confirmation test
                            masih required. Frontend tidak menentukan apa yang dianggap positif.
                          </p>
                          {can("dna.record-confirmation") ? (
                            <>
                              <Select
                                label="Hasil konfirmasi"
                                value={confirmationValue}
                                onChange={(e) => setConfirmationValue(e.target.value)}
                                options={[
                                  { value: "NEGATIVE", label: "NEGATIVE" },
                                  { value: "NON_NEGATIVE", label: "NON_NEGATIVE" },
                                ]}
                              />
                              {confirmationError && (
                                <p className="text-sm text-danger-600">{confirmationError}</p>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleConfirmation}
                                loading={confirmationBusy}
                                data-testid="submit-confirmation"
                              >
                                Simpan hasil konfirmasi
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">
                              Pencatatan confirmation test hanya dapat dilakukan oleh Dokter OH.
                            </p>
                          )}
                        </div>
                      )}

                      {!needsConfirmation && !hasConfirmationResult(result) && (
                        <p className="text-xs text-slate-500">
                          API tidak menandai tes ini memerlukan confirmation test.
                        </p>
                      )}

                      <Button type="button" variant="ghost" size="sm" onClick={handleHide} data-testid="hide-dna-results">
                        <EyeOff className="size-3.5" />
                        Sembunyikan hasil
                      </Button>

                      {can("mcu.view-certificate-preview") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewOpen(true)}
                          data-testid="open-dna-certificate-preview"
                        >
                          Pratinjau Sertifikat D&amp;A
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {previewOpen && selected ? (
        <PreviewFrame
          title="Pratinjau Sertifikat D&A"
          onClose={() => setPreviewOpen(false)}
        >
          <DnaCertificatePreview test={selected} />
        </PreviewFrame>
      ) : null}
    </div>
  );
}
