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

export default function MyMCUPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const mcus = useStore((s) => s.mcus);

  if (!user) return null;
  const mine = mcus.filter((m) => {
    const emp = useStore.getState().employees.find((e) => e.employeeId === user.employeeId);
    return emp && m.employeeId === emp.id;
  });

  return (
    <div>
      <PageHeader title="MCU Saya" description="Status proses MCU saya." />
      <div className="rounded-xl border bg-white">
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
            {mine.map((m) => (
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
            {mine.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Belum ada MCU.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
