"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  Pill,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { useStore, useCurrentUser } from "@/lib/store";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { HEALTH_STATUS, MCU_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import Link from "next/link";

const COLORS = ["#10b981", "#f59e0b", "#f97316", "#3b82f6", "#ef4444"];

const NOW = Date.now();

export default function DashboardPage() {
  const user = useCurrentUser();
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const whs = useStore((s) => s.workHealthStatus);
  const stockBatches = useStore((s) => s.stockBatches);
  const medicines = useStore((s) => s.medicines);
  const certificates = useStore((s) => s.certificates);
  const diagnoses = useStore((s) => s.diagnoses);

  if (!user) return null;

  const role = user.role;
  const today = new Date().toISOString().slice(0, 10);
  const visitsToday = visits.filter((v) => v.date === today).length;
  const inQueue = visits.filter((v) => v.status === "In Queue" || v.status === "Registered").length;
  const awaitingReview = mcus.filter((m) => m.status === "Submitted" || m.status === "Resubmitted").length;
  const activeReferrals = visits.filter((v) => v.status === "Referred").length;
  const lowStock = stockBatches.filter((b) => {
    const med = medicines.find((m) => m.id === b.medicineId);
    return med && b.quantity < med.minStock;
  }).length;
  const expiringCert = certificates.filter(
    (c) => c.status === "valid" && new Date(c.validUntil).getTime() - NOW < 45 * 24 * 3600 * 1000
  ).length;

  const mcuStatusData = Object.keys(MCU_STATUS).map((k) => ({
    name: k,
    count: mcus.filter((m) => m.status === k).length,
  }));

  const healthStatusData = Object.keys(HEALTH_STATUS).map((k) => ({
    name: k,
    value: whs.filter((w) => w.status === k).length,
  }));

  const diagnosisData = diagnoses.map((d) => ({
    name: d.description.length > 24 ? d.description.slice(0, 24) + "…" : d.description,
    count: visits.filter((v) => v.diagnosisIds.includes(d.id)).length,
  })).filter((d) => d.count > 0);

  const isClinical = role === "doctor" || role === "clinic" || role === "admin";
  const isHrLike = role === "hr" || role === "management";
  const isOps = role === "admin" || role === "clinic";
  const isDoctor = role === "doctor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Selamat datang, {user.name}. Ringkasan sesuai peran {user.title}.
        </p>
      </div>

      {/* Stat cards per role */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isOps && (
          <>
            <StatCard label="Kunjungan hari ini" value={visitsToday} icon={<ClipboardList className="size-5" />} tone="info" />
            <StatCard label="Pasien dalam antrean" value={inQueue} icon={<Clock className="size-5" />} tone="warning" />
            <StatCard label="MCU menunggu review" value={awaitingReview} icon={<Stethoscope className="size-5" />} />
            <StatCard label="Rujukan aktif" value={activeReferrals} icon={<Users className="size-5" />} />
            <StatCard label="Stok obat rendah" value={lowStock} icon={<Pill className="size-5" />} tone="danger" />
            <StatCard label="Sertifikat segera kedaluwarsa" value={expiringCert} icon={<CalendarClock className="size-5" />} tone="warning" />
          </>
        )}
        {isDoctor && (
          <>
            <StatCard label="MCU menunggu review" value={awaitingReview} icon={<Stethoscope className="size-5" />} tone="info" />
            <StatCard label="Kunjungan hari ini" value={visitsToday} icon={<ClipboardList className="size-5" />} />
            <StatCard label="Sertifikat diterbitkan" value={certificates.length} icon={<BadgeCheck className="size-5" />} tone="success" />
            <StatCard label="Rujukan aktif" value={activeReferrals} icon={<Users className="size-5" />} />
          </>
        )}
        {isHrLike && (
          <>
            <StatCard label="Total pekerja" value={employees.length} icon={<Users className="size-5" />} tone="info" />
            <StatCard label="Fit to Work" value={whs.filter((w) => w.status === "Fit to Work").length} icon={<Activity className="size-5" />} tone="success" />
            <StatCard label="Dengan restriction" value={whs.filter((w) => w.status === "Fit with Restriction").length} icon={<AlertTriangle className="size-5" />} tone="warning" />
            <StatCard label="Tidak fit sementara" value={whs.filter((w) => w.status === "Temporarily Unfit" || w.status === "Unfit").length} icon={<AlertTriangle className="size-5" />} tone="danger" />
          </>
        )}
        {role === "worker" && (
          <>
            <StatCard label="MCU saya" value={mcus.filter((m) => m.employeeId === user.employeeId).length} icon={<Stethoscope className="size-5" />} tone="info" />
            <StatCard label="Sertifikat saya" value={certificates.filter((c) => c.employeeId === user.employeeId).length} icon={<BadgeCheck className="size-5" />} tone="success" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(isOps || isDoctor) && (
          <Card>
            <CardHeader>
              <CardTitle>Distribusi Status MCU</CardTitle>
              <CardDescription>Jumlah MCU per status saat ini</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mcuStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {(isHrLike || isOps || isDoctor) && (
          <Card>
            <CardHeader>
              <CardTitle>Status Kesehatan Kerja</CardTitle>
              <CardDescription>Distribusi pekerja berdasarkan status</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {healthStatusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {isClinical && diagnosisData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribusi Diagnosis</CardTitle>
            <CardDescription>Diagnosis terbanyak dari kunjungan klinik</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={diagnosisData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Low stock list for ops */}
      {isOps && (
        <Card>
          <CardHeader>
            <CardTitle>Stok Obat Rendah</CardTitle>
            <CardDescription>Obat dengan stok di bawah batas minimum</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {stockBatches
              .filter((b) => {
                const med = medicines.find((m) => m.id === b.medicineId);
                return med && b.quantity < med.minStock;
              })
              .map((b) => {
                const med = medicines.find((m) => m.id === b.medicineId)!;
                return (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{med.name}</span>
                    <span className="text-red-600">
                      {b.quantity} {med.unit} <span className="text-muted-foreground">(min {med.minStock})</span>
                    </span>
                  </div>
                );
              })}
            {lowStock === 0 && <p className="text-sm text-muted-foreground">Tidak ada stok rendah.</p>}
          </CardContent>
        </Card>
      )}

      {/* Upcoming MCU / expiring certs for HR-like */}
      {isHrLike && (
        <Card>
          <CardHeader>
            <CardTitle>Sertifikat & Status Terkini</CardTitle>
            <CardDescription>Daftar status kesehatan kerja pekerja</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {whs.slice(0, 8).map((w) => {
              const emp = employees.find((e) => e.id === w.employeeId);
              return (
                <Link key={w.id} href={`/health-status`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                  <span className="font-medium">{emp?.fullName ?? w.employeeId}</span>
                  <span className="text-muted-foreground">{w.status} · s.d. {formatDate(w.validUntil)}</span>
                </Link>
              );
            })}
            {whs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada status kesehatan kerja.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
