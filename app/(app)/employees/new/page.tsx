"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { GENDERS, EMPLOYEE_STATUS_OPTIONS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Employee } from "@/lib/types";

export default function NewEmployeePage() {
  const router = useRouter();
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);
  const findDuplicates = useStore((s) => s.findDuplicates);
  const addEmployee = useStore((s) => s.addEmployee);

  const [form, setForm] = useState({
    fullName: "",
    nationalId: "",
    dateOfBirth: "",
    gender: "Male",
    companyId: "",
    departmentId: "",
    jobTitle: "",
    locationId: "",
    startDate: "",
    status: "Active",
    phone: "",
    email: "",
  });
  const [duplicates, setDuplicates] = useState<Employee[]>([]);
  const [pending, setPending] = useState<Employee[] | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    const dups = findDuplicates(form.nationalId, form.fullName);
    if (dups.length > 0) {
      setDuplicates(dups);
      setPending(dups);
    } else {
      save();
    }
  }

  function save() {
    if (!form.fullName || !form.nationalId || !form.companyId || !form.departmentId || !form.locationId) {
      toast.error("Lengkapi field wajib terlebih dahulu.");
      return;
    }
    const id = addEmployee({
      fullName: form.fullName,
      nationalId: form.nationalId,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender as Employee["gender"],
      companyId: form.companyId,
      departmentId: form.departmentId,
      jobTitle: form.jobTitle,
      locationId: form.locationId,
      startDate: form.startDate,
      status: form.status as Employee["status"],
      phone: form.phone,
      email: form.email,
    });
    toast.success("Pekerja berhasil didaftarkan.");
    router.push(`/employees/${id}`);
  }

  return (
    <div>
      <PageHeader title="Tambah Pekerja" description="Registrasi identitas tunggal pekerja.">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Pribadi</CardTitle>
            <CardDescription>Identitas resmi digunakan untuk pemeriksaan duplikasi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama lengkap *</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalId">Nomor identitas resmi (KTP) *</Label>
              <Input id="nationalId" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal lahir</Label>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jenis kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kontak (HP)</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informasi Pekerjaan</CardTitle>
            <CardDescription>Penempatan dan status pekerja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Perusahaan *</Label>
              <Select value={form.companyId} onValueChange={(v) => set("companyId", v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departemen *</Label>
              <Select value={form.departmentId} onValueChange={(v) => set("departmentId", v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih departemen" />
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
              <Label>Jabatan</Label>
              <Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lokasi kerja *</Label>
              <Select value={form.locationId} onValueChange={(v) => set("locationId", v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih lokasi" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal mulai kerja</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as string)}>
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
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button onClick={handleSubmit}>Simpan Pekerja</Button>
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kemungkinan duplikasi data</DialogTitle>
            <DialogDescription>
              Ditemukan pekerja dengan nomor identitas atau nama yang sama:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {duplicates.map((d) => (
              <div key={d.id} className="rounded-md border px-3 py-2 text-sm">
                {d.employeeId} — {d.fullName} (NIK {d.nationalId})
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setPending(null);
                save();
              }}
            >
              Tetap simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
