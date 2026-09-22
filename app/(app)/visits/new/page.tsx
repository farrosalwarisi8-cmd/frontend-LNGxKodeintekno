"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { EmployeePicker } from "@/components/employee-picker";
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
import { toast } from "sonner";
import type { Employee } from "@/lib/types";

export default function RegisterVisitPage() {
  const router = useRouter();
  const locations = useStore((s) => s.locations);
  const registerVisit = useStore((s) => s.registerVisit);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [locationId, setLocationId] = useState("");
  const [complaint, setComplaint] = useState("");

  function submit() {
    if (!employee) {
      toast.error("Pilih pekerja terlebih dahulu.");
      return;
    }
    const id = registerVisit({
      employeeId: employee.id,
      locationId: locationId || locations[0]?.id || "",
      chiefComplaint: complaint || "Kontrol rutin",
    });
    toast.success("Kunjungan terdaftar.");
    router.push(`/visits/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Patient Registration" description="Identifikasi pekerja dan daftarkan kunjungan.">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Registrasi Kunjungan</CardTitle>
          <CardDescription>Nomor kunjungan dan antrean dibuat otomatis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pekerja *</Label>
            <EmployeePicker onSelect={setEmployee} />
            {employee && (
              <p className="text-xs text-muted-foreground">
                Terpilih: {employee.employeeId} — {employee.fullName}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Lokasi klinik</Label>
            <Select value={locationId} onValueChange={(v) => setLocationId(v as string)}>
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
          <div className="space-y-2">
            <Label>Keluhan utama</Label>
            <Input value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="mis. Demam dan batuk" />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button onClick={submit}>Daftarkan</Button>
      </div>
    </div>
  );
}
