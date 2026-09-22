"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 10;

export default function EmployeesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.employeeId.toLowerCase().includes(q) ||
        e.fullName.toLowerCase().includes(q) ||
        e.nationalId.includes(q)
    );
  }, [employees, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const name = (id: string, list: { id: string; name: string }[]) =>
    list.find((x) => x.id === id)?.name ?? "—";

  if (!user) return null;
  const canManage = can(user.role, "manage-employees");

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Kelola identitas tunggal pekerja."
      >
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari ID, nama, atau nomor identitas…"
            className="w-64 pl-8"
          />
        </div>
        {canManage && (
          <Button onClick={() => router.push("/employees/new")}>
            <Plus /> Tambah Pekerja
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Perusahaan</TableHead>
              <TableHead>Departemen</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.map((e) => (
              <TableRow
                key={e.id}
                className="cursor-pointer"
                onClick={() => router.push(`/employees/${e.id}`)}
              >
                <TableCell className="font-medium">{e.employeeId}</TableCell>
                <TableCell>{e.fullName}</TableCell>
                <TableCell>{name(e.companyId, companies)}</TableCell>
                <TableCell>{name(e.departmentId, departments)}</TableCell>
                <TableCell>{name(e.locationId, locations)}</TableCell>
                <TableCell>{e.jobTitle}</TableCell>
                <TableCell>
                  <StatusBadge value={e.status} kind="employee" />
                </TableCell>
              </TableRow>
            ))}
            {current.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Tidak ada data pekerja.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4 pb-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
