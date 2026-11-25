"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
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
import { useDebounce } from "@/shared/utils/use-debounce";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/lib/i18n";

/**
 * Direktori Pekerja.
 *
 * Daftar ini TIDAK lagi memakai VirtualList: `syncPatients` memuat maksimal
 * 100 baris sekaligus, sehingga kartu biasa lebih sederhana, tidak memiliki
 * scrollbar internal di tengah halaman, dan tinggi kartu tidak perlu ditebak
 * (sebelumnya slot virtual 112px + tinggi kartu ~130px membuat jarak antar
 * kartu terlihat besar). Bila kelak data melebihi beberapa ratus baris,
 * paginasi server-side lebih tepat daripada virtualisasi berukuran tetap.
 */
export default function EmployeesPage() {
  const { t: translate } = useI18n();
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);

  // Modul 2 — sinkron daftar pekerja (pasien) dari backend
  const { loading, error, refetch } = useSyncedModules(() => syncPatients(1, 100));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const filtered = employees.filter((e) => {
    const q = debouncedSearch.trim().toLowerCase();
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
          <h1 className="text-2xl font-semibold text-foreground">{translate("page.employees.title")}</h1>
          <p className="text-sm text-muted-foreground">{translate("page.employees.subtitle")}</p>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Input
              id="employee-search"
              aria-label="Cari pekerja"
              placeholder="Nama, Employee ID, MRN, atau NIK"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search />}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex">
            <Select
              label="Perusahaan"
              placeholder="Semua perusahaan"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Status"
              placeholder="Semua status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={Object.entries(EMPLOYEE_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {filtered.length} pekerja ditemukan
      </p>

      {error && <ErrorState title="Gagal memuat data pekerja" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
          <Skeleton className="h-[76px] w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Tidak ada pekerja ditemukan"
          description="Coba ubah kata kunci pencarian atau filter Anda."
        />
      ) : !loading && !error ? (
        <ul className="space-y-2.5">
          {filtered.map((emp) => {
            const company = companies.find((c) => c.id === emp.companyId);
            const statusMeta = EMPLOYEE_STATUS[emp.status];
            return (
              <li key={emp.id}>
                <Link
                  href={`/people/${emp.id}`}
                  className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar name={emp.fullName} size="md" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{emp.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {emp.employeeId} · {emp.mrn}
                    </p>
                    {company?.name && (
                      <p className="truncate text-xs text-muted-foreground">{company.name}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge meta={statusMeta} fallback={emp.status} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
