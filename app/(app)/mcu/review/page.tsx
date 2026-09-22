"use client";

import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
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
import { formatDate } from "@/lib/format";

export default function ReviewQueuePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const mcus = useStore((s) => s.mcus);
  const employees = useStore((s) => s.employees);

  if (!user) return null;
  const queue = mcus.filter((m) => m.status === "Submitted" || m.status === "Resubmitted");

  return (
    <div>
      <PageHeader
        title="MCU Review Queue"
        description="Antrean MCU yang menunggu review dokter."
      />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. MCU</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((m) => {
              const emp = employees.find((e) => e.id === m.employeeId);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.mcuNumber}</TableCell>
                  <TableCell>
                    {emp?.fullName ?? "—"}
                    <span className="block text-xs text-muted-foreground">{emp?.employeeId}</span>
                  </TableCell>
                  <TableCell>{m.type}</TableCell>
                  <TableCell>{formatDate(m.examDate)}</TableCell>
                  <TableCell>
                    <StatusBadge value={m.status} kind="mcu" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => router.push(`/mcu/${m.id}`)}>
                      <Stethoscope /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {queue.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Tidak ada MCU dalam antrean review.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
