"use client";

import { Can } from "@/components/can";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, UserRound, ChevronRight, Plus } from "lucide-react";
import type { ConsentStatus, EmploymentStatus, ListPeopleParams } from "../api/people.types";
import { usePeople } from "../hooks/use-people";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Card } from "@/shared/components/design-system/card";
import { ConsentStatusBadge, EmploymentStatusBadge } from "@/shared/components/design-system/badge";
import { PeopleListSkeleton } from "@/shared/components/design-system/skeleton";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { ORGANIZATIONS, ORG_UNITS, SITES } from "../fixtures/people.fixtures";
import { formatRelativeTime } from "@/shared/utils/date";
import { maskEmail } from "@/shared/utils/masking";

export function PeopleList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({
    organizationId: "",
    orgUnitId: "",
    siteId: "",
    employmentStatus: "" as EmploymentStatus | "",
    consentStatus: "" as ConsentStatus | "",
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params: ListPeopleParams = {
    search: debouncedSearch || undefined,
    organizationId: filters.organizationId || undefined,
    orgUnitId: filters.orgUnitId || undefined,
    siteId: filters.siteId || undefined,
    employmentStatus: filters.employmentStatus || undefined,
    consentStatus: filters.consentStatus || undefined,
    page,
    pageSize: 10,
  };

  const { data, loading, error, refetch } = usePeople(params);

  const filteredOrgUnits = ORG_UNITS.filter(
    (ou) => !filters.organizationId || ou.organizationId === filters.organizationId
  );
  const filteredSites = SITES.filter(
    (s) => !filters.orgUnitId || s.orgUnitId === filters.orgUnitId
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">People & Medical Record</h1>
          <p className="text-sm text-slate-500">Kelola data administratif dan consent pekerja</p>
        </div>
        <Can action="people.create">
          <Link href="/people/new">
            <Button>
              <Plus className="size-4" />
              Tambah pekerja
            </Button>
          </Link>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, MRN, atau Employee ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10"
              aria-label="Cari pekerja"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              placeholder="Organisasi"
              value={filters.organizationId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilters((f) => ({ ...f, organizationId: e.target.value, orgUnitId: "", siteId: "" }));
                setPage(1);
              }}
              options={ORGANIZATIONS.map((o) => ({ value: o.id, label: o.name }))}
              aria-label="Filter organisasi"
            />
            <Select
              placeholder="Unit Kerja"
              value={filters.orgUnitId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilters((f) => ({ ...f, orgUnitId: e.target.value, siteId: "" }));
                setPage(1);
              }}
              options={filteredOrgUnits.map((o) => ({ value: o.id, label: o.name }))}
              aria-label="Filter unit kerja"
            />
            <Select
              placeholder="Site"
              value={filters.siteId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilters((f) => ({ ...f, siteId: e.target.value }));
                setPage(1);
              }}
              options={filteredSites.map((s) => ({ value: s.id, label: s.name }))}
              aria-label="Filter site"
            />
            <Select
              placeholder="Status"
              value={filters.employmentStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilters((f) => ({ ...f, employmentStatus: e.target.value as EmploymentStatus | "" }));
                setPage(1);
              }}
              options={[
                { value: "ACTIVE", label: "Aktif" },
                { value: "INACTIVE", label: "Nonaktif" },
                { value: "ARCHIVED", label: "Arsip" },
              ]}
              aria-label="Filter status employment"
            />
            <Select
              placeholder="Consent"
              value={filters.consentStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setFilters((f) => ({ ...f, consentStatus: e.target.value as ConsentStatus | "" }));
                setPage(1);
              }}
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
                { value: "EXPIRED", label: "Expired" },
                { value: "DELIVERY_FAILED", label: "Delivery Failed" },
              ]}
              aria-label="Filter status consent"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <PeopleListSkeleton />
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Tidak ada pekerja ditemukan"
          description={
            debouncedSearch || Object.values(filters).some(Boolean)
              ? "Coba ubah kata kunci pencarian atau filter Anda."
              : "Mulai dengan menambahkan pekerja pertama."
          }
          action={
            <Can action="people.create">
              <Link href="/people/new">
                <Button variant="outline" size="sm">
                  <Plus className="size-3.5" />
                  Tambah pekerja
                </Button>
              </Link>
            </Can>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {data.total} pekerja · Diperbarui {formatRelativeTime(data.data[0]?.updatedAt)}
          </p>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">MRN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Employee ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Consent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((person) => (
                  <tr
                    key={person.id}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => router.push(`/people/${person.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{person.fullName}</div>
                      <div className="text-xs text-slate-500">{maskEmail(person.emailMasked)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{person.mrn}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{person.employeeNo}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{person.siteName}</td>
                    <td className="px-4 py-3">
                      <ConsentStatusBadge status={person.consentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <EmploymentStatusBadge status={person.employmentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="size-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {data.data.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/30">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                    {person.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900">{person.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {person.mrn} · {person.employeeNo}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <ConsentStatusBadge status={person.consentStatus} />
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-400" />
                </Card>
              </Link>
            ))}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Sebelumnya
              </Button>
              <span className="text-sm text-slate-500">
                Halaman {data.page} dari {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
