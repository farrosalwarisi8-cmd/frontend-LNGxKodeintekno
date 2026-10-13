"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { UserRound, Building2, Phone, Mail, Calendar, FileText, HeartPulse } from "lucide-react";

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Profil Saya</h1>
      <p className="text-sm text-slate-500">Informasi data diri dan employment</p>
    </div>
  );
}

export default function MyProfilePage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  if (!user) return null;

  const employee = employees.find((e) => e.employeeId === user.employeeId);
  if (!employee) {
    return (
      <div className="space-y-4">
        <PageTitle />
        <EmptyState
          icon={UserRound}
          title="Data pekerja tidak ditemukan"
          description="Akun Anda belum tertaut ke data pekerja. Hubungi admin klinik atau HR untuk menautkannya."
        />
      </div>
    );
  }

  const company = companies.find((c) => c.id === employee.companyId);
  const dept = departments.find((d) => d.id === employee.departmentId);
  const loc = locations.find((l) => l.id === employee.locationId);

  return (
    <div className="space-y-4">
      <PageTitle />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={employee.fullName} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{employee.fullName}</h2>
            <p className="text-sm text-slate-500">{employee.employeeId} · {employee.mrn}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="success">{employee.status}</Badge>
              <Badge variant="default">{employee.gender}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-slate-400" />
              Employment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Perusahaan:</span> {company?.name}</p>
            <p><span className="text-slate-500">Departemen:</span> {dept?.name}</p>
            <p><span className="text-slate-500">Jabatan:</span> {employee.jobTitle}</p>
            <p><span className="text-slate-500">Lokasi:</span> {loc?.name}</p>
            <p><span className="text-slate-500">Tanggal Bergabung:</span> {formatDate(employee.startDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-slate-400" />
              Kontak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-500">Email:</span> {employee.email}</p>
            <p><span className="text-slate-500">Telepon:</span> {employee.phone}</p>
            <p><span className="text-slate-500">Tanggal Lahir:</span> {formatDate(employee.dateOfBirth)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-slate-400" />
            Dokumen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada dokumen.</p>
          ) : (
            <div className="space-y-2">
              {employee.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.type} · {formatDate(doc.uploadedAt)}</p>
                  </div>
                  <Badge variant="success">Verified</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
