"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { formatDate } from "@/lib/format";
import { BarChart3, Download, TrendingUp, Users, Activity, HeartPulse, Pill } from "lucide-react";

export default function ReportsPage() {
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const dispensings = useStore((s) => s.dispensings);
  const diagnoses = useStore((s) => s.diagnoses);

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const totalMCU = mcus.length;
  const approvedMCU = mcus.filter((m) => m.status === "Approved" || m.status === "Closed").length;
  const totalVisits = visits.length;
  const completedVisits = visits.filter((v) => v.status === "Completed").length;

  const fitToWork = workHealthStatus.filter((w) => w.status === "Fit to Work").length;
  const fitWithRestriction = workHealthStatus.filter((w) => w.status === "Fit with Restriction").length;
  const temporarilyUnfit = workHealthStatus.filter((w) => w.status === "Temporarily Unfit").length;
  const unfit = workHealthStatus.filter((w) => w.status === "Unfit").length;

  const diagnosisCounts = diagnoses.map((d) => ({
    ...d,
    count: visits.filter((v) => v.diagnosisIds?.includes(d.id)).length,
  })).sort((a, b) => b.count - a.count).slice(0, 10);

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
        <Button variant="outline">
          <Download className="size-4" />
          Ekspor PDF
        </Button>
      </div>

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
            <div className="space-y-2">
              {diagnosisCounts.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{d.code} — {d.description}</span>
                  <Badge variant="info">{d.count}</Badge>
                </div>
              ))}
            </div>
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
