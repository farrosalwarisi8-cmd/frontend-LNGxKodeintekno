"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { VISIT_STATUS } from "@/lib/constants";
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
import { Pagination } from "@/components/pagination";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 10;

export default function VisitsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = visits;
    if (status !== "all") list = list.filter((v) => v.status === status);
    if (q) {
      list = list.filter((v) => {
        const emp = employees.find((e) => e.id === v.employeeId);
        return (
          v.visitNumber.toLowerCase().includes(q) ||
          (emp?.fullName.toLowerCase().includes(q) ?? false) ||
          (emp?.employeeId.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return list;
  }, [visits, employees, query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Clinic Visits" description="Kunjungan klinik dan rekam medis.">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari nomor / pekerja…" className="w-56 pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as string); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {Object.keys(VISIT_STATUS).map((s) => (
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
              <TableHead>No. Kunjungan</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Keluhan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.map((v) => {
              const emp = employees.find((e) => e.id === v.employeeId);
              return (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => router.push(`/visits/${v.id}`)}>
                  <TableCell className="font-medium">{v.visitNumber}</TableCell>
                  <TableCell>
                    {emp?.fullName ?? "—"}
                    <span className="block text-xs text-muted-foreground">{emp?.employeeId}</span>
                  </TableCell>
                  <TableCell>{locations.find((l) => l.id === v.locationId)?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(v.date)}</TableCell>
                  <TableCell>{v.chiefComplaint}</TableCell>
                  <TableCell>
                    <StatusBadge value={v.status} kind="visit" />
                  </TableCell>
                </TableRow>
              );
            })}
            {current.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Tidak ada kunjungan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4 pb-3">
          <Pagination page={page} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
