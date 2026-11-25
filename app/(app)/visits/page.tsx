"use client";

import { Can, useCan } from "@/components/can";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { syncQueues, useSyncedModules } from "@/lib/remote-sync";
import { VISIT_STATUS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ClipboardList, ChevronRight, ExternalLink } from "lucide-react";
import { useDebounce } from "@/shared/utils/use-debounce";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/lib/i18n";

export default function VisitsPage() {
  const { t: translate } = useI18n();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);

  // Kolom klinis (keluhan utama, diagnosis) hanya ditampilkan untuk role yang
  // punya akses catatan klinis. Admin Klinik (registrasi & antrean) tidak
  // punya akses tersebut — data klinis tidak boleh bocor lewat UI.
  const can = useCan();
  const showClinical = can("visits.view-clinical");
  const isClinicAdmin = can("visits.call-ticket") && !showClinical;

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
      // Pencarian tidak boleh memakai keluhan utama untuk role tanpa akses klinis.
      (showClinical && v.chiefComplaint.toLowerCase().includes(q));
    const matchStatus = !statusFilter || v.status === statusFilter;
    const matchLocation = !locationFilter || v.locationId === locationFilter;
    return matchSearch && matchStatus && matchLocation;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{translate("page.visits.title")}</h1>
          <p className="text-sm text-muted-foreground">{translate("page.visits.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Can action="visits.refer">
            <Link href="/visits/referrals">
              <Button variant="outline">
                <ExternalLink className="size-4" />
                {translate("referral.action")}
              </Button>
            </Link>
          </Can>
          <Can action="visits.create">
            <Link href="/visits/new">
              <Button>
                <Plus className="size-4" />
                Kunjungan Baru
              </Button>
            </Link>
          </Can>
        </div>
      </div>

      {isClinicAdmin && (
        <p className="text-sm text-muted-foreground" role="status">
          Field klinis dibatasi untuk role Admin Klinik.
        </p>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Input
              placeholder="Cari nomor kunjungan, nama pasien..."
              aria-label="Cari kunjungan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search />}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              label="Status"
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={Object.entries(VISIT_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
            <Select
              label="Lokasi"
              placeholder="Lokasi"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
          </div>
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">{filtered.length} kunjungan ditemukan</p>

      {error && (
        <ErrorState
          title={translate("visits.errorTitle")}
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
          icon={ClipboardList}
          title={translate("visits.emptyTitle")}
          description={translate("visits.emptyDesc")}
        />
      ) : !loading && !error ? (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Kunjungan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Pasien</th>
                  {showClinical && (
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Keluhan</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Lokasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((visit) => {
                  const emp = employees.find((e) => e.id === visit.employeeId);
                  const loc = locations.find((l) => l.id === visit.locationId);
                  const statusMeta = VISIT_STATUS[visit.status];
                  return (
                    <tr key={visit.id} className="transition-colors hover:bg-muted">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-medium text-foreground">{visit.visitNumber}</div>
                        <div className="text-xs text-muted-foreground">Antrean #{visit.queueNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp?.fullName ?? "?"} size="sm" />
                          <div>
                            <div className="text-sm font-medium text-foreground">{emp?.fullName}</div>
                            <div className="text-xs text-muted-foreground">{emp?.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      {showClinical && (
                        <td className="px-4 py-3 text-sm text-text-secondary">{visit.chiefComplaint}</td>
                      )}
                      <td className="px-4 py-3 text-sm text-text-secondary">{loc?.name}</td>
                      <td className="px-4 py-3">
                        <StatusBadge meta={statusMeta} />
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="size-4 text-muted-foreground" />
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
                      <div className="font-medium text-foreground">{emp?.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {visit.visitNumber}
                        {showClinical ? ` · ${visit.chiefComplaint}` : ""}
                      </div>
                      <div className="mt-1">
                        <StatusBadge meta={statusMeta} />
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
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
