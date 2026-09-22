"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { MCU_TYPES } from "@/lib/constants";
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

export default function NewMCUPage() {
  const router = useRouter();
  const createMCU = useStore((s) => s.createMCU);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [type, setType] = useState<string>(MCU_TYPES[0]);
  const [examDate, setExamDate] = useState("");
  const [facility, setFacility] = useState("Klinik Kodein");

  function submit() {
    if (!employee) {
      toast.error("Pilih pekerja terlebih dahulu.");
      return;
    }
    const id = createMCU({
      employeeId: employee.id,
      type: type as never,
      examDate: examDate || new Date().toISOString().slice(0, 10),
      facility,
    });
    toast.success("Permintaan MCU dibuat.");
    router.push(`/mcu/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Buat Permintaan MCU" description="Buat permintaan MCU untuk satu pekerja.">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Data Permintaan</CardTitle>
          <CardDescription>MCU selalu terhubung dengan satu Employee ID.</CardDescription>
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
            <Label>Jenis MCU</Label>
            <Select value={type} onValueChange={(v) => setType(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MCU_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal pemeriksaan</Label>
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fasilitas pemeriksaan</Label>
              <Input value={facility} onChange={(e) => setFacility(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button onClick={submit}>Buat Permintaan</Button>
      </div>
    </div>
  );
}
