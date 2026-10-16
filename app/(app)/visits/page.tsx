"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncQueues, useSyncedModules } from "@/lib/remote-sync";
import { VISIT_STATUS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ClipboardList, ChevronRight } from "lucide-react";
import { useDebounce } from "@/shared/utils/use-debounce";

export default function VisitsPage() {
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);

  // Modul 3 — sinkron antrean/kunjungan dari backend (GET /clinic/queues)
  const { loading, error, refetch } = useSyncedModules(() => syncQueues());

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  const filtered = visits.filter((v) => {
    const emp = employees.find((e) => e.id === v.employeeId);
    const q = debouncedSearch.toLowerCase();
    const matchSearch =
      !q ||
      v.visitNumber.toLowerCase().includes(q) ||
      emp?.fullName.toLowerCase().includes(q) ||
      v.chiefComplaint.toLowerCase().includes(q);
    const matchStatus = !statusFilter || v.status === statusFilter;
    const matchLocation = !locationFilter || v.locationId === locationFilter;
    return matchSearch && matchStatus && matchLocation;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kunjungan Klinik</h1>
          <p className="text-sm text-slate-500">Kelola kunjungan pasien dan antrean</p>
        </div>
        <Can action="visits.create">
          <Link href="/visits/new">
            <Button>
              <Plus className="size-4" />
              Kunjungan Baru
            </Button>
          </Link>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Cari nomor kunjungan, nama pasien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={Object.entries(VISIT_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
            <Select
              placeholder="Lokasi"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} kunjungan ditemukan</p>

      {error && (
        <ErrorState title="Gagal memuat data kunjungan" message={error} onRetry={refetch} />
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
          icon={ClipboardList}
          title="Tidak ada kunjungan ditemukan"
          description="Coba ubah kata kunci pencarian atau filter Anda."
        />
      ) : !loading && !error ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Kunjungan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Pasien</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Keluhan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((visit) => {
                  const emp = employees.find((e) => e.id === visit.employeeId);
                  const loc = locations.find((l) => l.id === visit.locationId);
                  const statusMeta = VISIT_STATUS[visit.status];
                  return (
                    <tr key={visit.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-medium text-slate-900">{visit.visitNumber}</div>
                        <div className="text-xs text-slate-500">Antrean #{visit.queueNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp?.fullName ?? "?"} size="sm" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">{emp?.fullName}</div>
                            <div className="text-xs text-slate-500">{emp?.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{visit.chiefComplaint}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{loc?.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusMeta?.color}>
                          {statusMeta?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="size-4 text-slate-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filtered.map((visit) => {
              const emp = employees.find((e) => e.id === visit.employeeId);
              const statusMeta = VISIT_STATUS[visit.status];
              return (
                <Card key={visit.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp?.fullName ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{emp?.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {visit.visitNumber} · {visit.chiefComplaint}
                      </div>
                      <div className="mt-1">
                        <Badge variant="outline" className={statusMeta?.color}>
                          {statusMeta?.label}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-slate-500" />
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
