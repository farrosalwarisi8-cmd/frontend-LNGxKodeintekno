"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_STATUS_OPTIONS } from "@/lib/constants";
import { formatDate, age, initials } from "@/lib/format";
import { toast } from "sonner";
import type { Employee } from "@/lib/types";

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const employee = useStore((s) => s.employees.find((e) => e.id === params.id));
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const certificates = useStore((s) => s.certificates);
  const whs = useStore((s) => s.workHealthStatus);
  const updateEmployee = useStore((s) => s.updateEmployee);
  const [editOpen, setEditOpen] = useState(false);

  if (!user || !employee) {
    return <div className="text-muted-foreground">Pekerja tidak ditemukan.</div>;
  }

  const empMcus = mcus.filter((m) => m.employeeId === employee.id);
  const empVisits = visits.filter((v) => v.employeeId === employee.id);
  const empCerts = certificates.filter((c) => c.employeeId === employee.id);
  const empWhs = whs.filter((w) => w.employeeId === employee.id);

  const canManage = can(user.role, "manage-employees");
  const seeClinical = can(user.role, "view-diagnosis");

  const lookup = (id: string, list: { id: string; name: string }[]) =>
    list.find((x) => x.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Employee Profile">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarFallback>{initials(employee.fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{employee.fullName}</h2>
              <p className="text-sm text-muted-foreground">
                {employee.employeeId} · {employee.jobTitle}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge value={employee.status} kind="employee" />
                <span className="text-xs text-muted-foreground">
                  {lookup(employee.companyId, companies)} — {lookup(employee.locationId, locations)}
                </span>
              </div>
            </div>
          </div>
          {canManage && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Ubah
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="health">Health Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
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
                <CardTitle>Status Kesehatan Kerja</CardTitle>
                <CardDescription>Ringkasan status terbaru</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {empWhs.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada status kesehatan kerja.</p>
                )}
                {empWhs.map((w) => (
                  <div key={w.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge value={w.status} kind="health" />
                      <span className="text-xs text-muted-foreground">s.d. {formatDate(w.validUntil)}</span>
                    </div>
                    {w.recommendation && (
                      <p className="mt-1 text-sm text-muted-foreground">Rekomendasi: {w.recommendation}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employment">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Pekerjaan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Perusahaan" value={lookup(employee.companyId, companies)} />
              <Row label="Departemen" value={lookup(employee.departmentId, departments)} />
              <Row label="Lokasi kerja" value={lookup(employee.locationId, locations)} />
              <Row label="Jabatan" value={employee.jobTitle} />
              <Row label="Tanggal mulai" value={formatDate(employee.startDate)} />
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Riwayat Penempatan</CardTitle>
              <CardDescription>Perubahan penempatan tidak menghapus histori sebelumnya.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sejak</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead>Jabatan</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.employmentHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.from)}</TableCell>
                      <TableCell>{lookup(h.departmentId, departments)}</TableCell>
                      <TableCell>{lookup(h.locationId, locations)}</TableCell>
                      <TableCell>{h.jobTitle}</TableCell>
                      <TableCell>{h.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Riwayat MCU</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. MCU</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Keputusan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empMcus.map((m) => (
                      <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/mcu/${m.id}`)}>
                        <TableCell className="font-medium">{m.mcuNumber}</TableCell>
                        <TableCell>{m.type}</TableCell>
                        <TableCell>{formatDate(m.examDate)}</TableCell>
                        <TableCell>
                          <StatusBadge value={m.status} kind="mcu" />
                        </TableCell>
                        <TableCell>{m.decision ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    {empMcus.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-4 text-center text-muted-foreground">
                          Belum ada MCU.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Riwayat Kunjungan Klinik</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Kunjungan</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Keluhan</TableHead>
                      {seeClinical && <TableHead>Diagnosis</TableHead>}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {empVisits.map((v) => (
                      <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/visits/${v.id}`)}>
                        <TableCell className="font-medium">{v.visitNumber}</TableCell>
                        <TableCell>{formatDate(v.date)}</TableCell>
                        <TableCell>{v.chiefComplaint}</TableCell>
                        {seeClinical && <TableCell>{v.diagnosisNote || "—"}</TableCell>}
                        <TableCell>
                          <StatusBadge value={v.status} kind="visit" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {empVisits.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={seeClinical ? 5 : 4} className="py-4 text-center text-muted-foreground">
                          Belum ada kunjungan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sertifikat Kesehatan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {empCerts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/certificates/${c.id}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{c.certNumber}</span>
                    <span className="text-muted-foreground">
                      <StatusBadge value={c.status} kind="cert" /> · s.d. {formatDate(c.validUntil)}
                    </span>
                  </Link>
                ))}
                {empCerts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada sertifikat.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={employee}
        departments={departments}
        locations={locations}
        onSave={(patch) => {
          updateEmployee(employee.id, patch);
          setEditOpen(false);
          toast.success("Data pekerja diperbarui.");
        }}
      />
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

function EditDialog({
  open,
  onOpenChange,
  employee,
  departments,
  locations,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee: Employee;
  departments: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onSave: (patch: Partial<Employee>) => void;
}) {
  const [form, setForm] = useState({
    departmentId: employee.departmentId,
    locationId: employee.locationId,
    jobTitle: employee.jobTitle,
    status: employee.status,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah Penempatan & Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Departemen</Label>
            <Select value={form.departmentId} onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v as string }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Lokasi</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v as string }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jabatan</Label>
            <Input value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Employee["status"] }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={() => onSave(form)}>Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
