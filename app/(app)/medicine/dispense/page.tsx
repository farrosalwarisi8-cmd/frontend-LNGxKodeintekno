"use client";

import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DispensePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);

  if (!user) return null;
  const open = visits.filter((v) => ["Registered", "In Queue", "In Consultation", "Awaiting Pharmacy"].includes(v.status));

  return (
    <div>
      <PageHeader
        title="Medicine Dispensing"
        description="Pilih kunjungan untuk pemberian obat. Stok berkurang otomatis setelah konfirmasi."
      />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Kunjungan</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Keluhan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {open.map((v) => {
              const emp = employees.find((e) => e.id === v.employeeId);
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.visitNumber}</TableCell>
                  <TableCell>{emp?.fullName ?? "—"}</TableCell>
                  <TableCell>{v.chiefComplaint}</TableCell>
                  <TableCell>
                    <StatusBadge value={v.status} kind="visit" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/visits/${v.id}`)}>
                      Dispensing
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {open.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Tidak ada kunjungan terbuka untuk dispensing.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
