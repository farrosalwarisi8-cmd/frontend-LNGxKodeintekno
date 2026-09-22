"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

export default function AuditLogsPage() {
  const user = useCurrentUser();
  const auditLogs = useStore((s) => s.auditLogs);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Audit Logs" description="Riwayat perubahan status dan aksi penting." />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Objek</TableHead>
              <TableHead>Sebelum</TableHead>
              <TableHead>Sesudah</TableHead>
              <TableHead>Alasan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditLogs.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="whitespace-nowrap">{formatDateTime(a.at)}</TableCell>
                <TableCell>{a.userName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{a.action}</Badge>
                </TableCell>
                <TableCell>{a.objectType}</TableCell>
                <TableCell>{a.before ?? "—"}</TableCell>
                <TableCell>{a.after ?? "—"}</TableCell>
                <TableCell className="max-w-xs whitespace-normal">{a.reason ?? "—"}</TableCell>
              </TableRow>
            ))}
            {auditLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Belum ada audit log.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
