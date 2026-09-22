"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HEALTH_STATUS, MCU_STATUS } from "@/lib/constants";
import { toast } from "sonner";

const COLORS = ["#10b981", "#f59e0b", "#f97316", "#3b82f6", "#ef4444"];

export default function ReportsPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const whs = useStore((s) => s.workHealthStatus);
  const diagnoses = useStore((s) => s.diagnoses);

  const [companyId, setCompanyId] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [locationId, setLocationId] = useState("all");

  const scopedEmployees = useMemo(() => {
    return employees.filter(
      (e) =>
        (companyId === "all" || e.companyId === companyId) &&
        (departmentId === "all" || e.departmentId === departmentId) &&
        (locationId === "all" || e.locationId === locationId)
    );
  }, [employees, companyId, departmentId, locationId]);

  if (!user) return null;
  const seeClinical = can(user.role, "view-clinical-notes");

  const scopedIds = new Set(scopedEmployees.map((e) => e.id));

  const healthData = Object.keys(HEALTH_STATUS).map((k) => ({
    name: k,
    value: whs.filter((w) => scopedIds.has(w.employeeId) && w.status === k).length,
  }));

  const mcuData = Object.keys(MCU_STATUS).map((k) => ({
    name: k,
    count: mcus.filter((m) => scopedIds.has(m.employeeId) && m.status === k).length,
  }));

  const diagnosisData = diagnoses
    .map((d) => ({
      name: d.code,
      count: visits.filter((v) => scopedIds.has(v.employeeId) && v.diagnosisIds.includes(d.id)).length,
    }))
    .filter((d) => d.count > 0);

  const visitsCount = visits.filter((v) => scopedIds.has(v.employeeId)).length;

  return (
    <div>
      <PageHeader title="Reports & Analytics" description="Laporan sesuai role dan filter dasar.">
        <Button variant="outline" onClick={() => toast.success("Export dummy: laporan preview diunduh.")}>
          <Download /> Export
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Perusahaan</span>
            <Select value={companyId} onValueChange={(v) => setCompanyId(v as string)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Departemen</span>
            <Select value={departmentId} onValueChange={(v) => setDepartmentId(v as string)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Lokasi</span>
            <Select value={locationId} onValueChange={(v) => setLocationId(v as string)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="ml-auto text-sm text-muted-foreground">
            {scopedEmployees.length} pekerja · {visitsCount} kunjungan
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Kesehatan Kerja</CardTitle>
            <CardDescription>Distribusi pekerja per status</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={healthData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {healthData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status MCU</CardTitle>
            <CardDescription>Jumlah MCU per status</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mcuData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {seeClinical && diagnosisData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tren Diagnosis</CardTitle>
              <CardDescription>Diagnosis terbanyak (klinis)</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {!seeClinical && user.role === "hr" && (
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan Aktivitas Klinik</CardTitle>
              <CardDescription>Data agregat tanpa detail diagnosis individual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Total kunjungan: <strong>{visitsCount}</strong></p>
              <p>MCU disetujui: <strong>{mcus.filter((m) => scopedIds.has(m.employeeId) && m.status === "Approved").length}</strong></p>
              <p>Restriction aktif: <strong>{whs.filter((w) => scopedIds.has(w.employeeId) && w.status === "Fit with Restriction").length}</strong></p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
