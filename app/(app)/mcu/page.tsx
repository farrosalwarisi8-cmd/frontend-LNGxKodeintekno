"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncMcu, syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { MCU_STATUS, MCU_TYPES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Search, Plus, Activity, ChevronRight } from "lucide-react";

export default function MCUPage() {
  const mcus = useStore((s) => s.mcus);
  const employees = useStore((s) => s.employees);

  // Modul 4 — sinkron siklus MCU dari backend (GET /mcu/cycles)
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncMcu(1, 100);
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = mcus.filter((m) => {
    const emp = employees.find((e) => e.id === m.employeeId);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.mcuNumber.toLowerCase().includes(q) ||
      emp?.fullName.toLowerCase().includes(q) ||
      emp?.employeeId.toLowerCase().includes(q);
    const matchStatus = !statusFilter || m.status === statusFilter;
    const matchType = !typeFilter || m.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Medical Check-Up</h1>
          <p className="text-sm text-slate-500">Kelola MCU pekerja dan kalkulasi klinis</p>
        </div>
        <Can action="mcu.create">
          <Link href="/mcu/new">
            <Button>
              <Plus className="size-4" />
              Buat MCU
            </Button>
          </Link>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Cari nomor MCU, nama pekerja..."
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
              options={Object.entries(MCU_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
            <Select
              placeholder="Tipe"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={MCU_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} MCU ditemukan</p>

      {error && <ErrorState title="Gagal memuat data MCU" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Tidak ada MCU ditemukan"
          description="Coba ubah kata kunci pencarian atau filter Anda."
        />
      ) : !loading && !error ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">MCU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Pekerja</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Tipe</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Keputusan</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((mcu) => {
                  const emp = employees.find((e) => e.id === mcu.employeeId);
                  const statusMeta = MCU_STATUS[mcu.status];
                  return (
                    <tr key={mcu.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-medium text-slate-900">{mcu.mcuNumber}</div>
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
                      <td className="px-4 py-3 text-sm text-slate-600">{mcu.type}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(mcu.examDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusMeta?.color}>
                          {statusMeta?.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{mcu.decision ?? "—"}</td>
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
            {filtered.map((mcu) => {
              const emp = employees.find((e) => e.id === mcu.employeeId);
              const statusMeta = MCU_STATUS[mcu.status];
              return (
                <Card key={mcu.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp?.fullName ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{emp?.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {mcu.mcuNumber} · {mcu.type}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className={statusMeta?.color}>
                          {statusMeta?.label}
                        </Badge>
                        {mcu.decision && (
                          <span className="text-xs text-slate-500">{mcu.decision}</span>
                        )}
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
