"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Button } from "@/shared/components/design-system/button";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { Input } from "@/shared/components/design-system/input";
import { useSavedFilters } from "@/shared/hooks/use-saved-filters";
import { formatDate } from "@/lib/format";
import { encounterService, type BackendQueueTicket } from "@/lib/services/encounter.service";
import { ListOrdered, Clock, CheckCircle, PhoneCall, Search, X } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  WAITING: "warning",
  CALLED: "info",
  IN_SERVICE: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  WAITING: "Menunggu",
  CALLED: "Dipanggil",
  IN_SERVICE: "Dalam Pelayanan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export default function QueuePage() {
  const [tickets, setTickets] = useState<BackendQueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const siteId = useStore((s) => s.activeSiteId);
  const scopeVersion = useStore((s) => s.scopeVersion);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await encounterService.getQueues(siteId ?? undefined);
      setTickets(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat antrean dari backend.");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, scopeVersion]);

  const handleCallTicket = async (ticketId: string, counterId?: string) => {
    setCallingId(ticketId);
    setCallError(null);
    try {
      await encounterService.callNextTicket(counterId ?? "counter-1", ticketId);
      await load();
    } catch (e) {
      setCallError(e instanceof Error ? e.message : "Gagal memanggil tiket.");
    } finally {
      setCallingId(null);
    }
  };

  const waiting = tickets.filter((t) => t.status === "WAITING");
  const inService = tickets.filter((t) => t.status === "CALLED" || t.status === "IN_SERVICE");
  const completed = tickets.filter((t) => t.status === "COMPLETED");

  // Pencarian cepat: nama/MRN/nomor tiket. Filter tersimpan supaya perawat
  // tidak perlu mengetik ulang setiap membuka halaman.
  const { filters, setFilter, reset, active: filterActive } = useSavedFilters(
    "visits-queue",
    { search: "", waitingOnly: "0" }
  );
  const needle = filters.search.trim().toLowerCase();
  const waitingOnly = filters.waitingOnly === "1";
  const visible = tickets.filter((ticket) => {
    if (waitingOnly && ticket.status !== "WAITING") return false;
    if (!needle) return true;
    const name = ticket.appointment?.patient?.full_name ?? "";
    const mrn = ticket.appointment?.patient?.medical_record_no ?? "";
    return (
      name.toLowerCase().includes(needle) ||
      mrn.toLowerCase().includes(needle) ||
      (ticket.ticket_no ?? "").toLowerCase().includes(needle)
    );
  });

  // Tindakan paling sering perawat: memanggil pasien berikutnya dari antrean.
  const nextWaiting = waiting[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Antrean Klinik</h1>
          <p className="text-sm text-muted-foreground">
            Kelola antrean pasien real-time dari backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Can action="visits.call-ticket">
            <Button
              onClick={() =>
                nextWaiting && handleCallTicket(nextWaiting.id, nextWaiting.counter_id ?? undefined)
              }
              disabled={!nextWaiting || callingId !== null}
              loading={callingId === nextWaiting?.id && callingId !== null}
            >
              <PhoneCall className="size-4" />
              Panggil berikutnya
              {nextWaiting ? ` (#${nextWaiting.ticket_no})` : ""}
            </Button>
          </Can>
          <Button variant="outline" onClick={load} disabled={loading}>
            <ListOrdered className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {callError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {callError}
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Cari nama, MRN, atau nomor tiket..."
              aria-label="Cari antrean"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={waitingOnly ? "primary" : "outline"}
            aria-pressed={waitingOnly}
            size="sm"
            onClick={() => setFilter("waitingOnly", waitingOnly ? "0" : "1")}
          >
            <Clock className="size-4" />
            Hanya menunggu ({waiting.length})
          </Button>
          {filterActive && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" />
              Reset filter
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <ListOrdered className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{waiting.length}</p>
              <p className="text-xs text-muted-foreground">Menunggu</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{inService.length}</p>
              <p className="text-xs text-muted-foreground">Dalam Pelayanan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{completed.length}</p>
              <p className="text-xs text-muted-foreground">Selesai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <ErrorState title="Gagal memuat antrean" message={error} onRetry={load} />
      )}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={tickets.length === 0 ? "Tidak ada antrean" : "Tidak ada tiket yang cocok"}
          description={
            tickets.length === 0
              ? "Belum ada tiket antrean pada site ini."
              : "Ubah kata kunci pencarian atau reset filter."
          }
          icon={ListOrdered}
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-3">
          {visible.map((ticket) => {
            const patientName =
              ticket.appointment?.patient?.full_name ?? "Pasien";
            const mrn = ticket.appointment?.patient?.medical_record_no ?? "—";
            const statusMeta = STATUS_VARIANT[ticket.status] ?? "default";

            return (
              <Card key={ticket.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-lg font-bold text-primary-700">
                      {ticket.ticket_no.replace(/\D/g, "").slice(-3) ?? "—"}
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar name={patientName} />
                      <div>
                        <p className="font-medium text-foreground">{patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          MRN: {mrn} · {ticket.appointment?.visit_type ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.appointment?.scheduled_at
                            ? formatDate(ticket.appointment.scheduled_at)
                            : ""}
                          {ticket.counter ? ` · Counter ${ticket.counter.name}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusMeta}>
                      {STATUS_LABEL[ticket.status] ?? ticket.status}
                    </Badge>
                    <Can action="visits.call-ticket">
                      {ticket.status === "WAITING" && (
                        <Button
                          size="sm"
                          onClick={() => handleCallTicket(ticket.id, ticket.counter_id ?? undefined)}
                          disabled={callingId === ticket.id}
                        >
                          <PhoneCall className="size-3.5" />
                          {callingId === ticket.id ? "Memanggil..." : "Panggil"}
                        </Button>
                      )}
                    </Can>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
