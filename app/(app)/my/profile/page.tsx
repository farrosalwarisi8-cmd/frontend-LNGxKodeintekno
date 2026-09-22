"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initials, formatDate, age } from "@/lib/format";

export default function MyProfilePage() {
  const user = useCurrentUser();
  const employee = useStore((s) => s.employees.find((e) => e.employeeId === user?.employeeId));
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  if (!user) return null;
  if (!employee) {
    return <div className="text-muted-foreground">Profil pekerja tidak ditemukan.</div>;
  }

  const lookup = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Profil Saya" />
      <Card className="mb-4">
        <CardContent className="flex items-center gap-4 py-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(employee.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold">{employee.fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {employee.employeeId} · {employee.jobTitle}
            </p>
            <StatusBadge value={employee.status} kind="employee" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Pribadi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nomor identitas" value={employee.nationalId} />
            <Row label="Tanggal lahir" value={`${formatDate(employee.dateOfBirth)} (${age(employee.dateOfBirth)} th)`} />
            <Row label="Jenis kelamin" value={employee.gender} />
            <Row label="Telepon" value={employee.phone} />
            <Row label="Email" value={employee.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pekerjaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Perusahaan" value={lookup(employee.companyId, companies)} />
            <Row label="Departemen" value={lookup(employee.departmentId, departments)} />
            <Row label="Lokasi" value={lookup(employee.locationId, locations)} />
            <Row label="Tanggal mulai" value={formatDate(employee.startDate)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
