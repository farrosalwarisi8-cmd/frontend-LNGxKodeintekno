"use client";

import { useStore } from "@/lib/store";
import { syncPatients, syncWorkHealthStatus, useSyncedModules } from "@/lib/remote-sync";
import { HEALTH_STATUS } from "@/lib/constants";
import { RestrictionAcknowledgementSection } from "@/features/mcu/components/restriction-acknowledgement";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { Button } from "@/shared/components/design-system/button";
import { useSavedFilters } from "@/shared/hooks/use-saved-filters";
import { MCU_DUE_SOON_DAYS, isDueSoon, todayIso } from "@/shared/utils/due-soon";
import { formatDate } from "@/lib/format";
import { Search, AlertTriangle, CheckCircle, Clock, ClipboardCheck, Filter, X } from "lucide-react";

export default function HealthStatusPage() {
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const employees = useStore((s) => s.employees);

  // Modul 4 — status kesehatan kerja (FTW) diambil dari backend
  // (GET /mcu/cycles -> ftw_assessment + restrictions), bukan data seed lokal.
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncWorkHealthStatus(1, 100);
  });

  // HR/PIC & HSE memakai filter yang sama setiap hari → disimpan otomatis.
  // Tautan pintasan dari dashboard (`?filter=due-soon` / `?filter=restriction`)
  // menang atas nilai tersimpan supaya pintasan selalu bekerja.
  const {
    filters,
    setFilter,
    reset: resetFilters,
    active: filtersActive,
    savedAt,
  } = useSavedFilters(
    "health-status",
    { search: "", status: "", dueSoon: "0", restriction: "0" },
    { queryPreset: true }
  );

  const today = todayIso();
  const dueSoonOnly = filters.dueSoon === "1";
  const restrictionOnly = filters.restriction === "1";

  const filtered = workHealthStatus.filter((w) => {
    const emp = employees.find((e) => e.id === w.employeeId);
    const q = filters.search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (emp?.fullName ?? "").toLowerCase().includes(q) ||
      (emp?.employeeId ?? "").toLowerCase().includes(q) ||
      (emp?.mrn ?? "").toLowerCase().includes(q);
    const matchStatus = !filters.status || w.status === filters.status;
    const matchDueSoon = !dueSoonOnly || isDueSoon(w.validUntil, today, MCU_DUE_SOON_DAYS);
    const matchRestriction = !restrictionOnly || Boolean(w.restriction);
    return matchSearch && matchStatus && matchDueSoon && matchRestriction;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Status Kesehatan Kerja</h1>
        <p className="text-sm text-slate-500">Pantau status kesehatan kerja pekerja</p>
      </div>

      {/* HSE only: komponen ini mengembalikan null bila role tidak punya
          permission `acknowledge-restriction` (route tetap view-health-status). */}
      <RestrictionAcknowledgementSection />

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <Input
              placeholder="Cari nama, MRN, atau NIP..."
              aria-label="Cari status kesehatan pekerja"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label=""
            aria-label="Filter status kesehatan"
            placeholder="Semua status"
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            options={Object.entries(HEALTH_STATUS).map(([value, { label }]) => ({ value, label }))}
          />
          <Button
            variant={dueSoonOnly ? "primary" : "outline"}
            size="sm"
            aria-pressed={dueSoonOnly}
            onClick={() => setFilter("dueSoon", dueSoonOnly ? "0" : "1")}
          >
            <Clock className="size-4" aria-hidden="true" />
            Jatuh tempo ≤ {MCU_DUE_SOON_DAYS} hari
          </Button>
          <Button
            variant={restrictionOnly ? "primary" : "outline"}
            size="sm"
            aria-pressed={restrictionOnly}
            onClick={() => setFilter("restriction", restrictionOnly ? "0" : "1")}
          >
            <AlertTriangle className="size-4" aria-hidden="true" />
            Ada restriction
          </Button>
        </div>
        {filtersActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Filter className="size-3.5" aria-hidden="true" />
            Filter tersimpan otomatis
            {savedAt && <span>· {new Date(savedAt).toLocaleTimeString("id-ID")}</span>}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <X className="size-4" aria-hidden="true" />
              Reset filter
            </Button>
          </div>
        )}
      </Card>

      <p className="text-sm text-slate-500" role="status">
        {filtered.length} dari {workHealthStatus.length} status kesehatan
      </p>

      {error && (
        <ErrorState
          title="Gagal memuat status kesehatan kerja"
          message={error}
          onRetry={refetch}
        />
      )}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={
            workHealthStatus.length === 0
              ? "Belum ada status kesehatan kerja"
              : "Tidak ada data yang cocok dengan filter"
          }
          description={
            workHealthStatus.length === 0
              ? "Status Fitness to Work akan tampil di sini setelah dokter menetapkan assessment pada siklus MCU."
              : "Ubah kata kunci atau reset filter yang tersimpan."
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
      <div className="space-y-3">
        {filtered.map((whs) => {
          const emp = employees.find((e) => e.id === whs.employeeId);
          const statusMeta = HEALTH_STATUS[whs.status];
          const isExpiringSoon = new Date(whs.validUntil).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000;
          return (
            <Card key={whs.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp?.fullName ?? "?"} />
                  <div>
                    <p className="font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">{emp?.employeeId} · {emp?.jobTitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={statusMeta?.color}>
                        {statusMeta?.label}
                      </Badge>
                      {isExpiringSoon && (
                        <Badge variant="warning">
                          <Clock className="size-3" />
                          Segera Berakhir
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Berlaku: {formatDate(whs.validFrom)} — {formatDate(whs.validUntil)}</p>
                  {whs.reviewDate && <p>Review: {formatDate(whs.reviewDate)}</p>}
                </div>
              </div>
              {whs.restriction && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Restriction: {whs.restriction}</span>
                </div>
              )}
              {whs.recommendation && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-info-50 p-3 text-sm text-info-700">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>Rekomendasi: {whs.recommendation}</span>
                </div>
              )}
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}
