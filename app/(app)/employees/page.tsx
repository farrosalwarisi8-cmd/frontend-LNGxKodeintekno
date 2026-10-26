"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { EMPLOYEE_STATUS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Users, ChevronRight } from "lucide-react";
import { VirtualList } from "@/shared/components/virtual-list";
import { useDebounce } from "@/shared/utils/use-debounce";
import { StatusBadge } from "@/components/status-badge";

export default function EmployeesPage() {
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);

  // Modul 2 — sinkron daftar pekerja (pasien) dari backend
  const { loading, error, refetch } = useSyncedModules(() => syncPatients(1, 100));

  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filtered = employees.filter((e) => {
    const q = debouncedSearch.toLowerCase();
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
          <h1 className="text-2xl font-semibold text-foreground">Pekerja</h1>
          <p className="text-sm text-muted-foreground">Kelola data pekerja dan employment</p>
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
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              label="Cari pekerja"
              placeholder="Cari nama, Employee ID, MRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              label="Perusahaan"
              placeholder="Perusahaan"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Status"
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={Object.entries(EMPLOYEE_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">{filtered.length} pekerja ditemukan</p>

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
        <VirtualList
          items={filtered}
          itemHeight={112}
          renderItem={(emp, index, style) => {
            const company = companies.find((c) => c.id === emp.companyId);
            const statusMeta = EMPLOYEE_STATUS[emp.status];
            return (
              <div
                key={emp.id}
                style={style}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer transition-colors hover:bg-muted"
                onClick={() => router.push(`/people/${emp.id}`)}
                role="button"
                tabIndex={0}
              >
                <Avatar name={emp.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">
                    {emp.fullName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {emp.employeeId} · {emp.mrn}
                  </div>
                  {company?.name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {company.name}
                    </div>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <StatusBadge meta={statusMeta} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            );
          }}
          style={{ maxHeight: "60vh", minHeight: 300 }}
          aria-label="Daftar pekerja"
        />
      ) : null}
    </div>
  );
}
