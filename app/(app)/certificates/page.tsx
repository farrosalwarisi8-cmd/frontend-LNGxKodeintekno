"use client";

import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
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

export default function CertificatesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const certificates = useStore((s) => s.certificates);
  const employees = useStore((s) => s.employees);

  if (!user) return null;
  const canIssue = can(user.role, "issue-certificate");

  return (
    <div>
      <PageHeader
        title="Health Certificates"
        description={
          canIssue
            ? "Sertifikat hanya dapat diterbitkan dari MCU yang disetujui."
            : "Daftar health certificate."
        }
      />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Sertifikat</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Status Kesehatan</TableHead>
              <TableHead>Diterbitkan</TableHead>
              <TableHead>Berlaku s.d.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((c) => {
              const emp = employees.find((e) => e.id === c.employeeId);
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/certificates/${c.id}`)}>
                  <TableCell className="font-medium">{c.certNumber}</TableCell>
                  <TableCell>{emp?.fullName ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge value={c.healthStatus} kind="health" />
                  </TableCell>
                  <TableCell>{formatDate(c.issuedAt)}</TableCell>
                  <TableCell>{formatDate(c.validUntil)}</TableCell>
                  <TableCell>
                    <StatusBadge value={c.status} kind="cert" />
                  </TableCell>
                </TableRow>
              );
            })}
            {certificates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
