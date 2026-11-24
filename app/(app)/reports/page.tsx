"use client";

import { Can, useCan } from "@/components/can";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore, useCurrentUser } from "@/lib/store";
import { useDemoMode } from "@/lib/demo-role";
import { can as hasPermission } from "@/lib/rbac";
import {
  syncDispensings,
  syncMcu,
  syncPatients,
  syncQueues,
  syncWorkHealthStatus,
  useSyncedModules,
} from "@/lib/remote-sync";
import {
  reportingService,
  type ReportDefinition,
  type TopDiseaseItem,
} from "@/lib/services/reporting.service";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  Activity,
  HeartPulse,
  Pill,
  BadgeCheck,
  ShieldCheck,
} from "lucide-react";

interface StatusBarProps {
  label: string;
  count: number;
  total: number;
  barClass: string;
}

/** Bar status dengan label + angka + persen (bukan warna saja). */
function StatusBar({ label, count, total, barClass }: StatusBarProps) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="shrink-0 font-medium text-foreground">
          {count}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({percent}%)</span>
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${count} dari ${total} (${percent}%)`}
      >
        <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const dispensings = useStore((s) => s.dispensings);
  const diagnoses = useStore((s) => s.diagnoses);
  const user = useCurrentUser();
  const { role } = useDemoMode();

  // RA-02 — filter laporan: perusahaan, departemen, lokasi, dan periode.
  const [companyFilter, setCompanyFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [periodDays, setPeriodDays] = useState("all");
  // Referensi waktu diambil sekali saat halaman dibuka agar render tetap murni.
  const [referenceNow] = useState(() => Date.now());

  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  // Pekerja hanya melihat ringkasan pribadi — tanpa agregat perusahaan.
  const isWorker = role === "pekerja";
  const canViewEmployees = role ? hasPermission(role, "manage-employees") : false;

  // Setiap kartu laporan memakai izin sesuai sumber datanya. Role non-klinis
  // (HR/PIC, System Administrator) tetap bisa memantau kepatuhan, tetapi tidak
  // melihat angka/kolom yang berasal dari data klinis.
  const can = useCan();
  const showMcuMetrics = !isWorker && can("reports.view-mcu");
  const showVisitMetrics = !isWorker && can("reports.view-visits");
  const showDiagnosisMetrics = !isWorker && can("reports.view-diagnosis");
  const showPharmacyMetrics = !isWorker && can("reports.view-pharmacy");

  const [topDiseases, setTopDiseases] = useState<TopDiseaseItem[]>([]);
  const [definitions, setDefinitions] = useState<ReportDefinition[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  // Peringatan ketika sebagian sumber data ditolak backend (mis. /patients untuk
  // role MANAGEMENT) agar angka parsial tidak disalahartikan sebagai "nol".
  const [partialNotice, setPartialNotice] = useState<string | null>(null);

  // Modul 8 — data laporan & analitik dari backend
  const { loading, error, refetch } = useSyncedModules(async () => {
    setPartialNotice(null);
    // Hanya sumber data yang boleh diakses role ini yang diambil, supaya
    // laporan non-klinis (HR/System Administrator) tidak memicu request
    // klinis yang pasti ditolak backend.
    const tasks: Array<Promise<unknown>> = [];
    if (!isWorker && canViewEmployees) tasks.push(syncPatients(1, 100));
    if (showMcuMetrics) tasks.push(syncMcu(1, 100));
    if (showVisitMetrics) tasks.push(syncQueues());
    if (showPharmacyMetrics) tasks.push(syncDispensings());
    // Status kepatuhan selalu berasal dari assessment FTW backend (bukan seed).
    tasks.push(syncWorkHealthStatus());

    // Satu sumber yang ditolak tidak boleh mengosongkan seluruh halaman laporan.
    const syncResults = await Promise.allSettled(tasks);
    const rejected = syncResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );
    if (rejected.length === syncResults.length) {
      throw rejected[0].reason;
    }
    if (rejected.length > 0) {
      setPartialNotice(
        "Sebagian data tidak dapat dimuat karena keterbatasan akses peran Anda; angka di bawah hanya mencakup sumber data yang berhasil dibaca."
      );
    }
    const [analytics, defs] = await Promise.all([
      showDiagnosisMetrics
        ? reportingService.topDiseases({}).catch(() => null)
        : Promise.resolve(null),
      reportingService.getDefinitions().catch(() => []),
    ]);
    setTopDiseases(analytics ? analytics.top10Morbidity ?? [] : []);
    setDefinitions(defs);
  });

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const def = definitions[0];
      if (!def) throw new Error("Tidak ada definisi laporan di backend.");
      const days = periodDays === "all" ? null : Number(periodDays);
      const startDate = days
        ? new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
        : `${new Date().getFullYear()}-01-01`;
      const run = await reportingService.runReport(def.id, "PDF", {
        startDate,
        endDate: new Date().toISOString().slice(0, 10),
      });
      const download = await reportingService.downloadExport(run.exportId);
      setExportMsg(`Laporan ${run.format} dibuat (${run.status}).`);
      if (download?.downloadUrl) {
        window.open(download.downloadUrl, "_blank", "noopener");
      }
    } catch (e) {
      setExportMsg(e instanceof Error ? e.message : "Ekspor laporan gagal.");
    } finally {
      setExporting(false);
    }
  };

  // --- RA-02: terapkan filter ke seluruh angka laporan -------------------
  const employeeFilterActive = Boolean(companyFilter || departmentFilter || locationFilter);
  const scopedEmployees = useMemo(() => {
    if (!employeeFilterActive) return employees;
    return employees.filter(
      (e) =>
        (!companyFilter || e.companyId === companyFilter) &&
        (!departmentFilter || e.departmentId === departmentFilter) &&
        (!locationFilter || e.locationId === locationFilter)
    );
  }, [employees, employeeFilterActive, companyFilter, departmentFilter, locationFilter]);
  const scopedEmployeeIds = useMemo(
    () => (employeeFilterActive ? new Set(scopedEmployees.map((e) => e.id)) : null),
    [employeeFilterActive, scopedEmployees]
  );
  const cutoffMs = periodDays === "all" ? null : referenceNow - Number(periodDays) * 86_400_000;
  const inPeriod = (value?: string) => {
    if (!cutoffMs) return true;
    if (!value) return false;
    const at = new Date(value).getTime();
    return Number.isFinite(at) && at >= cutoffMs;
  };
  const filterActive = employeeFilterActive || periodDays !== "all";

  const scopedMcus = useMemo(
    () =>
      mcus.filter(
        (m) => (!scopedEmployeeIds || scopedEmployeeIds.has(m.employeeId)) && inPeriod(m.examDate)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mcus, scopedEmployeeIds, cutoffMs]
  );
  const scopedVisits = useMemo(
    () =>
      visits.filter(
        (v) => (!scopedEmployeeIds || scopedEmployeeIds.has(v.employeeId)) && inPeriod(v.date)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visits, scopedEmployeeIds, cutoffMs]
  );
  const scopedStatus = useMemo(
    () =>
      workHealthStatus.filter(
        (w) =>
          (!scopedEmployeeIds || scopedEmployeeIds.has(w.employeeId)) && inPeriod(w.decisionDate)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workHealthStatus, scopedEmployeeIds, cutoffMs]
  );
  const scopedVisitIds = useMemo(() => new Set(scopedVisits.map((v) => v.id)), [scopedVisits]);
  const scopedDispensings = filterActive
    ? dispensings.filter((d) => !d.visitId || scopedVisitIds.has(d.visitId))
    : dispensings;

  const totalEmployees = scopedEmployees.length;
  const approvedMCU = scopedMcus.filter((m) => m.status === "Approved" || m.status === "Closed").length;
  const totalVisits = scopedVisits.length;

  const fitToWork = scopedStatus.filter((w) => w.status === "Fit to Work").length;
  const fitWithRestriction = scopedStatus.filter((w) => w.status === "Fit with Restriction").length;
  const temporarilyUnfit = scopedStatus.filter((w) => w.status === "Temporarily Unfit").length;
  const unfit = scopedStatus.filter((w) => w.status === "Unfit").length;

  const ownStatus =
    isWorker && user?.employeeId
      ? workHealthStatus.find((w) => w.employeeId === user.employeeId)
      : undefined;

  const diagnosisCounts = diagnoses.map((d) => ({
    ...d,
    count: scopedVisits.filter((v) => v.diagnosisIds?.includes(d.id)).length,
  })).sort((a, b) => b.count - a.count).slice(0, 10);

  // Backend bisa mengirim entri analitik tanpa kode/nama (mis. agregat kosong).
  // Baris tanpa label dibuang agar tabel tidak menampilkan "- —" dengan angka 0.
  // Analitik backend tidak menerima filter klien; saat filter aktif, angka
  // diturunkan dari kunjungan yang sudah difilter agar konsisten.
  const useBackendAnalytics = !filterActive && topDiseases.length > 0;
  const topRows = (
    useBackendAnalytics
      ? topDiseases.map((t, i) => {
          const code = (t.icd10Code ?? "").trim();
          const name = (t.diseaseName ?? "").trim();
          return {
            key: code || name || String(i),
            label: [code, name].filter(Boolean).join(" — "),
            count: t.totalCases ?? 0,
          };
        })
      : diagnosisCounts.map((d) => ({ key: d.id, label: `${d.code} — ${d.description}`, count: d.count }))
  ).filter((row) => row.label.length > 0);

  const mcuByType = ["Pre-Employment", "Periodic", "Return to Work", "Special"].map((type) => ({
    type,
    count: scopedMcus.filter((m) => m.type === type).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isWorker ? "Ringkasan Saya" : "Laporan & Analitik"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isWorker
              ? "Hanya data kesehatan milik Anda sendiri"
              : "Ringkasan sesuai cakupan peran Anda"}
          </p>
        </div>
        <Can action="reports.export">
          <Button variant="outline" onClick={handleExport} loading={exporting} disabled={exporting || loading}>
            <Download className="size-4" /> Ekspor PDF
          </Button>
        </Can>
      </div>

      {!isWorker && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {canViewEmployees && (
              <Select
                label="Perusahaan"
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setDepartmentFilter("");
                  setLocationFilter("");
                }}
                options={[
                  { value: "", label: "Semua perusahaan" },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}
            {canViewEmployees && (
              <Select
                label="Departemen"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                options={[
                  { value: "", label: "Semua departemen" },
                  ...departments
                    .filter((d) => !companyFilter || d.companyId === companyFilter)
                    .map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            )}
            {canViewEmployees && (
              <Select
                label="Lokasi"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                options={[
                  { value: "", label: "Semua lokasi" },
                  ...locations
                    .filter((l) => !companyFilter || l.companyId === companyFilter)
                    .map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            )}
            <Select
              label="Periode"
              value={periodDays}
              onChange={(e) => setPeriodDays(e.target.value)}
              options={[
                { value: "all", label: "Semua periode" },
                { value: "30", label: "30 hari terakhir" },
                { value: "90", label: "90 hari terakhir" },
                { value: "365", label: "1 tahun terakhir" },
              ]}
            />
            {filterActive && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCompanyFilter("");
                    setDepartmentFilter("");
                    setLocationFilter("");
                    setPeriodDays("all");
                  }}
                >
                  Reset filter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {filterActive && (
        <p role="status" className="text-xs text-muted-foreground">
          Angka di bawah mengikuti filter aktif; ekspor PDF mengikuti periode yang dipilih.
        </p>
      )}

      {exportMsg && (
        <div role="status" className="rounded-xl bg-muted p-3 text-sm text-text-secondary">
          {exportMsg}
        </div>
      )}

      {partialNotice && (
        <div role="status" className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
          {partialNotice}
        </div>
      )}

      {error && <ErrorState title="Gagal memuat data laporan" message={error} onRetry={refetch} />}

      {isWorker ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-600">
                  <HeartPulse className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-foreground">
                    {ownStatus?.status ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Status FTW saya</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info-100 text-info-600">
                  <Activity className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-foreground">
                    {ownStatus?.validUntil ? formatDate(ownStatus.validUntil) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Berlaku sampai</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
                  <ShieldCheck className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-foreground">
                    {ownStatus?.restriction ? "Ada" : "Tidak ada"}
                  </p>
                  <p className="text-xs text-muted-foreground">Restriksi kerja</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {loading && !error && (
            <p className="text-sm text-muted-foreground" role="status">
              Memuat ringkasan Anda…
            </p>
          )}

          {!loading && !ownStatus && !error && (
            <EmptyState
              icon={HeartPulse}
              title="Belum ada ringkasan kesehatan"
              description="Ringkasan akan tampil setelah dokter menetapkan status Fitness to Work pada MCU Anda."
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Dokumen saya</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/my/mcu"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-muted"
              >
                <Activity className="size-4" aria-hidden="true" /> Riwayat MCU saya
              </Link>
              <Link
                href="/my/certificates"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-muted"
              >
                <BadgeCheck className="size-4" aria-hidden="true" /> Sertifikat saya
              </Link>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {canViewEmployees && (
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Users className="size-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{totalEmployees}</p>
                    <p className="text-xs text-muted-foreground">Total Pekerja</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {showMcuMetrics && (
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-600">
                    <Activity className="size-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{approvedMCU}</p>
                    <p className="text-xs text-muted-foreground">MCU Approved</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {showVisitMetrics && (
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info-100 text-info-600">
                    <BarChart3 className="size-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{totalVisits}</p>
                    <p className="text-xs text-muted-foreground">Total Kunjungan</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {showPharmacyMetrics && (
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
                    <Pill className="size-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-foreground">{scopedDispensings.length}</p>
                    <p className="text-xs text-muted-foreground">Dispensing</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Status kesehatan & MCU per tipe memakai grid yang sama agar tepi
              kartu sejajar (bukan satu kartu penuh di bawah). */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Tanpa izin MCU, kartu status memenuhi lebar grid agar tidak
                menyisakan ruang kosong besar di kanan. */}
            <Card className={showMcuMetrics ? undefined : "lg:col-span-2"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HeartPulse className="size-5 text-success-600" aria-hidden="true" />
                  Status Kesehatan Kerja
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scopedStatus.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada status kesehatan kerja dari backend.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <StatusBar
                      label="Fit to Work"
                      count={fitToWork}
                      total={scopedStatus.length}
                      barClass="bg-success-500"
                    />
                    <StatusBar
                      label="Fit with Restriction"
                      count={fitWithRestriction}
                      total={scopedStatus.length}
                      barClass="bg-warning-500"
                    />
                    <StatusBar
                      label="Temporarily Unfit"
                      count={temporarilyUnfit}
                      total={scopedStatus.length}
                      barClass="bg-warning"
                    />
                    <StatusBar
                      label="Unfit"
                      count={unfit}
                      total={scopedStatus.length}
                      barClass="bg-danger-500"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {showMcuMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle>MCU per Tipe</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                    {mcuByType.map((item) => (
                      <div key={item.type} className="rounded-xl border border-border p-3 text-center">
                        <p className="text-2xl font-semibold text-foreground">{item.count}</p>
                        <p className="text-xs text-muted-foreground">{item.type}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {showDiagnosisMetrics && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="size-5 text-info-600" aria-hidden="true" />
                    Top 10 Diagnosis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topRows.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="Belum ada data diagnosis"
                      description="Data akan muncul setelah ada kunjungan dengan diagnosis ICD-10."
                    />
                  ) : (
                    <div className="space-y-2">
                      {topRows.map((d) => (
                        <div key={d.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-text-secondary" title={d.label}>
                            {d.label}
                          </span>
                          <Badge variant="info">{d.count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
