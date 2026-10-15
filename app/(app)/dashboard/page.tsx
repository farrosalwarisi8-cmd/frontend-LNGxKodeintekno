"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import {
  syncCertificates,
  syncInventory,
  syncMcu,
  syncPatients,
  syncQueues,
  syncWorkHealthStatus,
  useSyncedModules,
} from "@/lib/remote-sync";
import { ROLES, MCU_STATUS, HEALTH_STATUS, VISIT_STATUS, EMPLOYEE_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Avatar } from "@/shared/components/design-system/avatar";
import { cn } from "@/lib/utils";
import {
  Users,
  Activity,
  ClipboardList,
  Pill,
  BadgeCheck,
  AlertTriangle,
  Clock,
  TrendingUp,
  HeartPulse,
  CalendarCheck,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const dispensings = useStore((s) => s.dispensings);
  const certificates = useStore((s) => s.certificates);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const notifications = useStore((s) => s.notifications);
  const auditLogs = useStore((s) => s.auditLogs);
  const stockBatches = useStore((s) => s.stockBatches);
  const medicines = useStore((s) => s.medicines);

  // Dashboard — tarik ringkasan semua modul inti dari backend
  useSyncedModules(async () => {
    await Promise.all([
      syncPatients(1, 100),
      syncMcu(1, 100),
      syncQueues(),
      syncInventory(),
      syncWorkHealthStatus(1, 100),
      syncCertificates(1, 100),
    ]);
  });

  if (!user) return null;

  const roleMeta = ROLES[user.role];
  const myNotifications = notifications.filter((n) => n.userId === user.id);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const pendingMCU = mcus.filter((m) => m.status === "Submitted" || m.status === "Resubmitted").length;
  const approvedMCU = mcus.filter((m) => m.status === "Approved" || m.status === "Closed").length;
  const todayVisits = visits.filter((v) => v.status !== "Completed" && v.status !== "Referred").length;
  const validCerts = certificates.filter((c) => c.status === "valid").length;
  const fitToWork = workHealthStatus.filter((w) => w.status === "Fit to Work").length;
  const fitWithRestriction = workHealthStatus.filter((w) => w.status === "Fit with Restriction").length;
  const temporarilyUnfit = workHealthStatus.filter((w) => w.status === "Temporarily Unfit").length;
  const lowStock = stockBatches.filter((b) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    return med && b.quantity < med.minStock;
  }).length;

  const stats = [
    { label: "Total Pekerja", value: employees.length, icon: Users, color: "bg-primary-100 text-primary-700" },
    { label: "Pekerja Aktif", value: activeEmployees, icon: Users, color: "bg-success-100 text-success-600" },
    { label: "MCU Pending", value: pendingMCU, icon: Clock, color: "bg-warning-100 text-warning-600" },
    { label: "MCU Approved", value: approvedMCU, icon: Activity, color: "bg-info-100 text-info-600" },
    { label: "Kunjungan Hari Ini", value: todayVisits, icon: ClipboardList, color: "bg-purple-100 text-purple-600" },
    { label: "Sertifikat Valid", value: validCerts, icon: BadgeCheck, color: "bg-success-100 text-success-600" },
    { label: "Fit to Work", value: fitToWork, icon: HeartPulse, color: "bg-success-100 text-success-600" },
    { label: "Stok Rendah", value: lowStock, icon: AlertTriangle, color: "bg-danger-100 text-danger-600" },
  ];

  const recentMCU = mcus.slice(0, 5);
  const recentVisits = visits.slice(0, 5);
  const recentAudit = auditLogs.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Selamat datang, {user.name} — {roleMeta.label}
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-warning-50 px-4 py-2 text-sm text-warning-700">
            <AlertTriangle className="size-4" />
            {unreadCount} notifikasi belum dibaca
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", stat.color)}>
                  <Icon className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary-600" />
              MCU Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMCU.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data MCU.</p>
            ) : (
              <div className="space-y-3">
                {recentMCU.map((mcu) => {
                  const emp = employees.find((e) => e.id === mcu.employeeId);
                  const statusMeta = MCU_STATUS[mcu.status];
                  return (
                    <div key={mcu.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp?.fullName ?? "?"} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{emp?.fullName ?? "Unknown"}</p>
                          <p className="text-xs text-slate-500">{mcu.mcuNumber} · {mcu.type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusMeta?.color}>
                        {statusMeta?.label ?? mcu.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5 text-primary-600" />
              Kunjungan Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentVisits.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada kunjungan.</p>
            ) : (
              <div className="space-y-3">
                {recentVisits.map((visit) => {
                  const emp = employees.find((e) => e.id === visit.employeeId);
                  const statusMeta = VISIT_STATUS[visit.status];
                  return (
                    <div key={visit.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{emp?.fullName ?? "Unknown"}</p>
                        <p className="text-xs text-slate-500">{visit.visitNumber} · {visit.chiefComplaint}</p>
                      </div>
                      <Badge variant="outline" className={statusMeta?.color}>
                        {statusMeta?.label ?? visit.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
                <Badge variant="success">{fitToWork}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Fit with Restriction</span>
                <Badge variant="warning">{fitWithRestriction}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Temporarily Unfit</span>
                <Badge variant="danger">{temporarilyUnfit}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="size-5 text-info-600" />
              Farmasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Total Obat</span>
                <Badge variant="info">{medicines.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Batch Aktif</span>
                <Badge variant="info">{stockBatches.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Stok Rendah</span>
                <Badge variant={lowStock > 0 ? "danger" : "success"}>{lowStock}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5 text-purple-600" />
              Audit Log Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAudit.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{log.action}</span>
                  <span className="text-slate-400">{log.userName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
