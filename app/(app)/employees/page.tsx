"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { EMPLOYEE_STATUS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Users, ChevronRight } from "lucide-react";

export default function EmployeesPage() {
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  // Modul 2 — sinkron daftar pekerja (pasien) dari backend
  const { loading, error, refetch } = useSyncedModules(() => syncPatients(1, 100));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.fullName.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      e.mrn.toLowerCase().includes(q) ||
      e.nationalId.includes(q);
    const matchStatus = !statusFilter || e.status === statusFilter;
    const matchCompany = !companyFilter || e.companyId === companyFilter;
    return matchSearch && matchStatus && matchCompany;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pekerja</h1>
          <p className="text-sm text-slate-500">Kelola data pekerja dan employment</p>
        </div>
        <Can action="people.create">
          {/* /employees/new tidak ada — registrasi pekerja memakai wizard /people/new */}
          <Link href="/people/new">
            <Button>
              <Plus className="size-4" />
              Tambah Pekerja
            </Button>
          </Link>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, Employee ID, MRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              placeholder="Perusahaan"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={Object.entries(EMPLOYEE_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} pekerja ditemukan</p>

      {error && (
        <ErrorState
          title="Gagal memuat data pekerja"
          message={error}
          onRetry={refetch}
        />
      )}

      {loading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak ada pekerja ditemukan"
          description="Coba ubah kata kunci pencarian atau filter Anda."
        />
      ) : !loading && !error ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">MRN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Perusahaan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Departemen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => {
                  const company = companies.find((c) => c.id === emp.companyId);
                  const dept = departments.find((d) => d.id === emp.departmentId);
                  const loc = locations.find((l) => l.id === emp.locationId);
                  const statusMeta = EMPLOYEE_STATUS[emp.status];
                  return (
                    <tr key={emp.id} className="cursor-pointer transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} size="sm" />
                          <div>
                            <div className="font-medium text-slate-900">{emp.fullName}</div>
                            <div className="text-xs text-slate-500">{emp.jobTitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{emp.employeeId}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{emp.mrn}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{company?.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{dept?.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{loc?.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusMeta?.color}>
                          {statusMeta?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="size-4 text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filtered.map((emp) => {
              const company = companies.find((c) => c.id === emp.companyId);
              const statusMeta = EMPLOYEE_STATUS[emp.status];
              return (
                <Card key={emp.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp.fullName} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{emp.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {emp.employeeId} · {emp.mrn}
                      </div>
                      <div className="text-xs text-slate-500">{company?.name}</div>
                    </div>
                    <Badge variant="outline" className={statusMeta?.color}>
                      {statusMeta?.label}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
