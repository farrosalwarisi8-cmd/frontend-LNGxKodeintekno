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
import { formatDate } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/use-toast";
import {
  fetchDocuments,
  fetchReviewCycles,
  findDocumentForCycle,
  submitFtwAssessment,
} from "@/features/oh-review/api";
import { toReviewCycles, type ReviewCycle } from "@/features/oh-review/review-cycle";
import { ftwLabel } from "@/features/oh-review/ftw";
import { FtwDecisionDialog } from "@/features/oh-review/components/ftw-decision-dialog";
import { CalculatedValuesPanel } from "@/features/oh-review/components/calculated-values";
import { SupportingResultsPanel } from "@/features/oh-review/components/supporting-results-panel";
import { RestrictionList } from "@/features/oh-review/components/restriction-list";
import { Textarea } from "@/features/oh-review/components/textarea";
import { PreviewFrame } from "@/features/certificates/components/preview-frame";
import { ResumePreview } from "@/features/certificates/components/resume-preview";
import { FtwCertificatePreview } from "@/features/certificates/components/ftw-certificate-preview";
import { buildResumeModel } from "@/features/certificates/resume-model";
import type { BackendDocument } from "@/lib/services/document.service";
import type { FtwCategory } from "@/features/oh-review/ftw";
import { FileText, Filter, Info, Search, Stethoscope, WifiOff } from "lucide-react";

type PreviewKind = "resume" | "ftw";

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "__none__", label: "Belum ada keputusan FTW" },
  { value: "FIT", label: "Fit" },
  { value: "FIT_WITH_RESTRICTION", label: "Fit with Restriction" },
  { value: "TEMPORARILY_UNFIT", label: "Temporarily Unfit" },
  { value: "UNFIT", label: "Unfit" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Semua prioritas" },
  { value: "worsening", label: "Ada perburukan" },
  { value: "no-worsening", label: "Tanpa perburukan" },
  { value: "unknown", label: "Perburukan tidak tersedia" },
];

/**
 * A3 — Layar review MCU untuk Dokter OH (antrean + detail siklus).
 *
 * Identitas, hasil pemeriksaan, nilai terhitung, dan penanda perburukan
 * semuanya dibaca dari API. Frontend tidak menghitung apa pun.
 */
export function OhReviewWorkspace() {
  const can = useCan();
  const isOnline = useStore((s) => s.isOnline);

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [notesByCycle, setNotesByCycle] = useState<Record<string, string>>({});
  const [savedByCycle, setSavedByCycle] = useState<Record<string, string>>({});
  const [ftwOpen, setFtwOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewKind | null>(null);
  const [previewModel, setPreviewModel] = useState<ReturnType<typeof buildResumeModel> | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchReviewCycles({ page: 1, limit: 100, search: searchTerm || undefined });
      setCycles(toReviewCycles(page.cycles));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat antrean review MCU.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(search);
    }, 0);
    return () => clearTimeout(timer);
  }, [load, search, reloadKey]);

  const sites = useMemo(
    () => Array.from(new Set(cycles.map((cycle) => cycle.siteName).filter(Boolean))).sort(),
    [cycles]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cycles.filter((cycle) => {
      if (needle) {
        const haystack = [
          cycle.patientName,
          cycle.medicalRecordNo,
          cycle.employeeNo,
          cycle.mcuNumber,
          cycle.siteName,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (statusFilter === "__none__" && cycle.hasDecision) return false;
      if (statusFilter && statusFilter !== "__none__" && cycle.ftwStatus !== statusFilter) {
        return false;
      }
      if (siteFilter && cycle.siteName !== siteFilter) return false;
      if (dateFrom && cycle.examinationDate < dateFrom) return false;
      if (dateTo && cycle.examinationDate > dateTo) return false;
      if (priorityFilter === "worsening" && !cycle.worsening) return false;
      if (priorityFilter === "no-worsening" && cycle.worsening) return false;
      if (priorityFilter === "unknown" && cycle.worseningAvailable) return false;
      return true;
    });
  }, [cycles, search, statusFilter, siteFilter, dateFrom, dateTo, priorityFilter]);

  const selected = useMemo(
    () => filtered.find((cycle) => cycle.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const notes = selected ? (notesByCycle[selected.id] ?? "") : "";
  const savedNotes = selected ? (savedByCycle[selected.id] ?? "") : "";
  const dirty = notes !== savedNotes;

  // Konfirmasi sebelum meninggalkan halaman selagi ada draf yang belum disimpan.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const openPreview = async (kind: PreviewKind) => {
    if (!selected) return;
    setPreviewError(null);
    try {
      const documents: BackendDocument[] = await fetchDocuments();
      const document = findDocumentForCycle(documents, selected.mcuNumber);
      setPreviewModel(buildResumeModel(selected, document));
      setPreview(kind);
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : "Gagal memuat status dokumen untuk pratinjau."
      );
    }
  };

  const handleSubmitFtw = async (input: {
    ftwStatus: FtwCategory;
    reason: string;
    notes: string;
    restriction?: { description: string; reviewDate: string; supervisor?: string; controls?: string };
  }) => {
    if (!selected) return;
    setSubmitting(true);
    const summaryParts: string[] = [];
    if (input.reason.trim()) summaryParts.push(`Alasan deviasi dari saran sistem: ${input.reason.trim()}`);
    if (input.notes.trim()) summaryParts.push(input.notes.trim());
    try {
      await submitFtwAssessment({
        cycleId: selected.id,
        ftwStatus: input.ftwStatus,
        summary: summaryParts.join("\n\n") || undefined,
        restriction: input.restriction,
      });
      setSavedByCycle((prev) => ({ ...prev, [selected.id]: input.notes }));
      setNotesByCycle((prev) => ({ ...prev, [selected.id]: input.notes }));
      toastSuccess("Penetapan FTW tersimpan", "Keputusan terkunci dan hanya dapat dikoreksi lewat addendum.");
      await load(search);
    } catch (e) {
      toastError("Gagal menyimpan penetapan FTW", e instanceof Error ? e.message : undefined);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const sitesOption = useMemo(
    () => [{ value: "", label: "Semua site" }, ...sites.map((site) => ({ value: site, label: site }))],
    [sites]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Review MCU — Dokter OH</h1>
          <p className="text-sm text-slate-500">
            Antrean review, penetapan FTW, dan management restriksi kerja.
          </p>
        </div>
      </div>

      {!isOnline && (
        <div
          role="status"
          data-testid="oh-review-offline"
          className="flex items-center gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700"
        >
          <WifiOff className="size-4 shrink-0" />
          <span>
            Anda sedang offline. Data review tidak dapat dimuat atau disimpan sampai koneksi kembali.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary-600" />
            Filter antrean
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                label="Pencarian"
                placeholder="Nama, MRN, NIP, nomor MCU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              label="Status FTW"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
            />
            <Select
              label="Site"
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              options={sitesOption}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Input
              label="Tanggal pemeriksaan dari"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              label="Tanggal pemeriksaan sampai"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Select
              label="Prioritas perburukan"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              options={PRIORITY_OPTIONS}
              helper="Penanda perburukan hanya tampil bila API mengirim flag perbandingan."
            />
          </div>

          <p className="text-xs text-slate-500">
            Filter perusahaan tidak ditampilkan: kontrak siklus MCU tidak mengirim field perusahaan
            pada respons API.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="size-4 text-primary-600" />
              Antrean review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {!loading && error && (
              <ErrorState
                title="Gagal memuat antrean review"
                message={error}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            )}

            {!loading && !error && filtered.length === 0 && (
              <EmptyState
                icon={Search}
                title="Tidak ada siklus MCU yang cocok"
                description="Ubah filter atau kata kunci pencarian untuk menampilkan antrean lain."
              />
            )}

            {!loading && !error && filtered.length > 0 && (
              <ul className="space-y-2">
                {filtered.map((cycle) => (
                  <li key={cycle.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(cycle.id)}
                      data-testid={`review-queue-item-${cycle.id}`}
                      aria-pressed={selectedId === cycle.id}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        selectedId === cycle.id
                          ? "border-primary-500 bg-primary-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{cycle.patientName}</span>
                        <Badge variant={cycle.hasDecision ? "success" : "warning"}>
                          {cycle.hasDecision ? ftwLabel(cycle.ftwStatus) : "Menunggu review"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {cycle.mcuNumber} · {cycle.mcuTypeLabel} · {formatDate(cycle.examinationDate)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {cycle.employeeNo || "NIP belum tersedia"} · {cycle.siteName || "Site belum tersedia"}
                      </p>
                      {cycle.worsening && (
                        <Badge variant="danger" className="mt-2">
                          Perburukan dibanding tahun lalu
                        </Badge>
                      )}
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
                  Pilih satu siklus MCU di antrean untuk menampilkan hasil pemeriksaan.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card data-testid="review-detail">
                <CardHeader>
                  <CardTitle>Detail siklus MCU</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {[
                      { label: "Nama pekerja", value: selected.patientName },
                      { label: "MRN", value: selected.medicalRecordNo || "—" },
                      { label: "Nomor pekerja", value: selected.employeeNo || "—" },
                      { label: "Site", value: selected.siteName || "—" },
                      { label: "Jenis MCU", value: selected.mcuTypeLabel },
                      { label: "Tanggal pemeriksaan", value: formatDate(selected.examinationDate) },
                      { label: "Masa berlaku sampai", value: selected.validUntil ? formatDate(selected.validUntil) : "—" },
                      {
                        label: "Status FTW",
                        value: selected.hasDecision ? ftwLabel(selected.ftwStatus) : "Belum ada keputusan",
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col">
                        <dt className="text-xs text-slate-500">{item.label}</dt>
                        <dd className="text-sm text-slate-900">{item.value}</dd>
                      </div>
                    ))}
                  </dl>

                  {selected.ftwSummary ? (
                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="text-xs font-medium uppercase text-slate-500">Ringkasan keputusan</p>
                      <p className="mt-1 whitespace-pre-line">{selected.ftwSummary}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <CalculatedValuesPanel
                rows={selected.calculations}
                worseningAvailable={selected.worseningAvailable}
              />

              <SupportingResultsPanel cycleId={selected.id} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4 text-primary-600" />
                    Catatan dokter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    label="Catatan review"
                    value={notes}
                    onChange={(e) =>
                      setNotesByCycle((prev) => ({ ...prev, [selected.id]: e.target.value }))
                    }
                    rows={4}
                    helper="Catatan dikirim sebagai ringkasan pada penetapan FTW."
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500" data-testid="draft-status">
                      {dirty
                        ? "Ada perubahan yang belum disimpan."
                        : "Draf tersimpan di halaman ini saja (tidak disimpan di perangkat)."}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSavedByCycle((prev) => ({ ...prev, [selected.id]: notes }))}
                        disabled={!dirty}
                        data-testid="save-draft"
                      >
                        Simpan draf
                      </Button>
                    </div>
                  </div>
                  <p className="flex items-start gap-2 text-xs text-slate-500">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Backend belum menyediakan endpoint draf review MCU, jadi draf hanya bertahan
                      selama halaman ini terbuka.
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Penetapan FTW</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selected.hasDecision ? (
                    <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <span>
                        Keputusan: <strong>{ftwLabel(selected.ftwStatus)}</strong>
                        {selected.ftwDecisionAt ? ` (${formatDate(selected.ftwDecisionAt)})` : ""}.
                        Keputusan terkunci di layar ini — koreksi dilakukan lewat addendum (A4).
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Belum ada keputusan FTW pada siklus ini.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {can("mcu.set-ftw") ? (
                      <Button
                        type="button"
                        onClick={() => setFtwOpen(true)}
                        loading={submitting}
                        data-testid="open-ftw-decision"
                      >
                        {selected.hasDecision ? "Tetapkan ulang FTW" : "Tetapkan FTW"}
                      </Button>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Penetapan FTW hanya dapat dilakukan oleh Dokter OH.
                      </p>
                    )}
                    {can("mcu.view-resume") ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void openPreview("resume")}
                        data-testid="open-resume-preview"
                      >
                        Pratinjau Resume
                      </Button>
                    ) : null}
                    {can("mcu.view-certificate-preview") ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void openPreview("ftw")}
                        data-testid="open-certificate-preview"
                      >
                        Pratinjau Sertifikat
                      </Button>
                    ) : null}
                  </div>

                  {previewError && (
                    <p className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                      {previewError}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Restriksi kerja</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RestrictionList restrictions={selected.restrictions} />
                  <p className="text-xs text-slate-500">
                    Management restriksi (tambah/ubah/akhiri) dilakukan oleh Dokter OH pada halaman
                    Restriksi Kerja.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <FtwDecisionDialog
        key={ftwOpen ? "ftw-dialog-open" : "ftw-dialog-closed"}
        open={ftwOpen}
        onClose={() => setFtwOpen(false)}
        mcuNumber={selected?.mcuNumber ?? ""}
        suggested={selected?.suggestedFtw ?? null}
        notes={notes}
        locked={Boolean(selected?.hasDecision)}
        onSubmit={handleSubmitFtw}
      />

      {preview && previewModel ? (
        <PreviewFrame
          title={preview === "resume" ? "Pratinjau Resume MCU" : "Pratinjau Sertifikat FTW"}
          onClose={() => setPreview(null)}
        >
          {preview === "resume" ? (
            <ResumePreview model={previewModel} />
          ) : (
            <FtwCertificatePreview model={previewModel} />
          )}
        </PreviewFrame>
      ) : null}
    </div>
  );
}
