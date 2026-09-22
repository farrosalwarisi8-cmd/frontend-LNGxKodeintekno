"use client";

import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export default function MedicalRecordsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const diagnoses = useStore((s) => s.diagnoses);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Medical Records"
        description="Rekam medis dari kunjungan klinik (akses terbatas sesuai role)."
      />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Kunjungan</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead>Tindakan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((v) => {
              const emp = employees.find((e) => e.id === v.employeeId);
              const dx = v.diagnosisIds.map((id) => diagnoses.find((d) => d.id === id)?.code).filter(Boolean).join(", ");
              return (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/visits/${v.id}`)}>
                  <TableCell className="font-medium">{v.visitNumber}</TableCell>
                  <TableCell>{emp?.fullName ?? "—"}</TableCell>
                  <TableCell>{formatDate(v.date)}</TableCell>
                  <TableCell>{dx || "—"}</TableCell>
                  <TableCell>{v.treatment || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge value={v.status} kind="visit" />
                  </TableCell>
                </TableRow>
              );
            })}
            {visits.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Belum ada rekam medis.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
