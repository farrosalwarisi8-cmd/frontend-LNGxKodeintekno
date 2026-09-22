"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { HEALTH_STATUS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export default function HealthStatusPage() {
  const user = useCurrentUser();
  const whs = useStore((s) => s.workHealthStatus);
  const employees = useStore((s) => s.employees);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = whs;
    if (status !== "all") list = list.filter((w) => w.status === status);
    if (q) {
      list = list.filter((w) => {
        const emp = employees.find((e) => e.id === w.employeeId);
        return emp?.fullName.toLowerCase().includes(q) ?? emp?.employeeId.toLowerCase().includes(q) ?? false;
      });
    }
    return list;
  }, [whs, employees, query, status]);

  if (!user) return null;
  const seeRestriction = can(user.role, "view-clinical-notes");

  return (
    <div>
      <PageHeader
        title="Work Health Status"
        description={
          user.role === "hr"
            ? "Status kelayakan kerja tanpa detail medis (sesuai prinsip minimum information)."
            : "Daftar status kesehatan kerja pekerja."
        }
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pekerja…" className="w-56 pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {Object.keys(HEALTH_STATUS).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pekerja</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Berlaku</TableHead>
              {seeRestriction && <TableHead>Restriction / Rekomendasi</TableHead>}
              <TableHead>Dokter</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((w) => {
              const emp = employees.find((e) => e.id === w.employeeId);
              return (
                <TableRow key={w.id}>
                  <TableCell>
                    <span className="font-medium">{emp?.fullName ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">{emp?.employeeId}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={w.status} kind="health" />
                  </TableCell>
                  <TableCell>
                    {formatDate(w.validFrom)} — {formatDate(w.validUntil)}
                  </TableCell>
                  {seeRestriction && (
                    <TableCell className="max-w-xs whitespace-normal">
                      {w.restriction ? (
                        <>
                          <span className="block">{w.restriction}</span>
                          <span className="text-xs text-muted-foreground">{w.recommendation}</span>
                        </>
                      ) : (
                        w.recommendation ?? "—"
                      )}
                    </TableCell>
                  )}
                  <TableCell>{w.doctorName}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={seeRestriction ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  Belum ada status kesehatan kerja.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
