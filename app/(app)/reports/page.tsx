"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  syncMcu,
  syncPatients,
  syncQueues,
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
import { BarChart3, Download, TrendingUp, Users, Activity, HeartPulse, Pill } from "lucide-react";

export default function ReportsPage() {
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const dispensings = useStore((s) => s.dispensings);
  const diagnoses = useStore((s) => s.diagnoses);

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
    // Satu sumber yang ditolak tidak boleh mengosongkan seluruh halaman laporan.
    const syncResults = await Promise.allSettled([
      syncPatients(1, 100),
      syncMcu(1, 100),
      syncQueues(),
    ]);
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
      reportingService.topDiseases({}).catch(() => null),
      reportingService.getDefinitions().catch(() => []),
    ]);
    setTopDiseases(analytics ? analytics.topDiseases ?? analytics.top10Morbidity ?? [] : []);
    setDefinitions(defs);
  });

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const def = definitions[0];
      if (!def) throw new Error("Tidak ada definisi laporan di backend.");
      const run = await reportingService.runReport(def.id, "PDF", {
        startDate: `${new Date().getFullYear()}-01-01`,
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

  const totalEmployees = employees.length;
  const approvedMCU = mcus.filter((m) => m.status === "Approved" || m.status === "Closed").length;
  const totalVisits = visits.length;

  const fitToWork = workHealthStatus.filter((w) => w.status === "Fit to Work").length;
  const fitWithRestriction = workHealthStatus.filter((w) => w.status === "Fit with Restriction").length;
  const temporarilyUnfit = workHealthStatus.filter((w) => w.status === "Temporarily Unfit").length;
  const unfit = workHealthStatus.filter((w) => w.status === "Unfit").length;

  const diagnosisCounts = diagnoses.map((d) => ({
    ...d,
    count: visits.filter((v) => v.diagnosisIds?.includes(d.id)).length,
  })).sort((a, b) => b.count - a.count).slice(0, 10);

  // Backend bisa mengirim entri analitik tanpa kode/nama (mis. agregat kosong).
  // Baris tanpa label dibuang agar tabel tidak menampilkan "- —" dengan angka 0.
  const topRows = (
    topDiseases.length > 0
      ? topDiseases.map((t, i) => {
          const code = (t.icd10 ?? t.code ?? "").trim();
          const name = (t.name ?? t.disease ?? "").trim();
          return {
            key: code || name || String(i),
            label: [code, name].filter(Boolean).join(" — "),
            count: t.caseCount ?? t.count ?? 0,
          };
        })
      : diagnosisCounts.map((d) => ({ key: d.id, label: `${d.code} — ${d.description}`, count: d.count }))
  ).filter((row) => row.label.length > 0);

  const mcuByType = ["Pre-Employment", "Periodic", "Return to Work", "Special"].map((type) => ({
    type,
    count: mcus.filter((m) => m.type === type).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Laporan & Analitik</h1>
          <p className="text-sm text-slate-500">Dashboard reporting per role</p>
        </div>
        <Can action="reports.export">
          <Button variant="outline" onClick={handleExport} loading={exporting} disabled={exporting || loading}>
            <Download className="size-4" />
            Ekspor PDF
          </Button>
        </Can>
      </div>

      {exportMsg && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{exportMsg}</div>
      )}

      {partialNotice && (
        <div role="status" className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
          {partialNotice}
        </div>
      )}

      {error && <ErrorState title="Gagal memuat data laporan" message={error} onRetry={refetch} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalEmployees}</p>
              <p className="text-xs text-slate-500">Total Pekerja</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <Activity className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{approvedMCU}</p>
              <p className="text-xs text-slate-500">MCU Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <BarChart3 className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalVisits}</p>
              <p className="text-xs text-slate-500">Total Kunjungan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Pill className="size-6" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{dispensings.length}</p>
              <p className="text-xs text-slate-500">Dispensing</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="size-5 text-success-600" />
              Status Kesehatan Kerja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Fit to Work</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-success-500" style={{ width: `${workHealthStatus.length > 0 ? (fitToWork / workHealthStatus.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{fitToWork}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Fit with Restriction</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-warning-500" style={{ width: `${workHealthStatus.length > 0 ? (fitWithRestriction / workHealthStatus.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{fitWithRestriction}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Temporarily Unfit</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-orange-500" style={{ width: `${workHealthStatus.length > 0 ? (temporarilyUnfit / workHealthStatus.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{temporarilyUnfit}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Unfit</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-danger-500" style={{ width: `${workHealthStatus.length > 0 ? (unfit / workHealthStatus.length) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{unfit}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-info-600" />
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
                    <span className="min-w-0 truncate text-slate-600" title={d.label}>
                      {d.label}
                    </span>
                    <Badge variant="info">{d.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCU per Tipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mcuByType.map((item) => (
              <div key={item.type} className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-semibold text-slate-900">{item.count}</p>
                <p className="text-xs text-slate-500">{item.type}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
