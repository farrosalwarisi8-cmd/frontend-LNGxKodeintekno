"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { MCU_STATUS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
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

export default function MCUListPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const mcus = useStore((s) => s.mcus);
  const employees = useStore((s) => s.employees);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = mcus;
    if (status !== "all") list = list.filter((m) => m.status === status);
    if (q) {
      list = list.filter((m) => {
        const emp = employees.find((e) => e.id === m.employeeId);
        return (
          m.mcuNumber.toLowerCase().includes(q) ||
          (emp?.fullName.toLowerCase().includes(q) ?? false) ||
          (emp?.employeeId.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return list;
  }, [mcus, employees, query, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!user) return null;
  const canCreate = can(user.role, "create-mcu");
  const isDoctor = user.role === "doctor";

  return (
    <div>
      <PageHeader title={isDoctor ? "MCU Review" : "MCU"} description="Permintaan dan hasil Medical Check Up.">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari nomor MCU / pekerja…" className="w-56 pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as string); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {Object.keys(MCU_STATUS).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canCreate && (
          <Button onClick={() => router.push("/mcu/new")}>
            <Plus /> Buat Permintaan MCU
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. MCU</TableHead>
              <TableHead>Pekerja</TableHead>
              <TableHead>Jenis</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Keputusan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.map((m) => {
              const emp = employees.find((e) => e.id === m.employeeId);
              return (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/mcu/${m.id}`)}>
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
                  <TableCell>{m.decision ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {current.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Tidak ada data MCU.
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
