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

export default function MyCertificatesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const certificates = useStore((s) => s.certificates);

  if (!user) return null;
  const mine = certificates.filter((c) => {
    const emp = useStore.getState().employees.find((e) => e.employeeId === user.employeeId);
    return emp && c.employeeId === emp.id;
  });

  return (
    <div>
      <PageHeader title="Sertifikat Saya" />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Sertifikat</TableHead>
              <TableHead>Status Kesehatan</TableHead>
              <TableHead>Diterbitkan</TableHead>
              <TableHead>Berlaku s.d.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mine.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/certificates/${c.id}`)}>
                <TableCell className="font-medium">{c.certNumber}</TableCell>
                <TableCell>
                  <StatusBadge value={c.healthStatus} kind="health" />
                </TableCell>
                <TableCell>{formatDate(c.issuedAt)}</TableCell>
                <TableCell>{formatDate(c.validUntil)}</TableCell>
                <TableCell>
                  <StatusBadge value={c.status} kind="cert" />
                </TableCell>
              </TableRow>
            ))}
            {mine.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Belum ada sertifikat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
