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
import { formatDate } from "@/lib/format";
import { encounterService, type BackendQueueTicket } from "@/lib/services/encounter.service";
import { ListOrdered, UserRound, Clock, CheckCircle, PhoneCall } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Antrean Klinik</h1>
          <p className="text-sm text-slate-500">
            Kelola antrean pasien real-time dari backend
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <ListOrdered className="size-4" />
          Refresh
        </Button>
      </div>

      {callError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {callError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <ListOrdered className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{waiting.length}</p>
              <p className="text-xs text-slate-500">Menunggu</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{inService.length}</p>
              <p className="text-xs text-slate-500">Dalam Pelayanan</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{completed.length}</p>
              <p className="text-xs text-slate-500">Selesai</p>
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

      {!loading && !error && tickets.length === 0 && (
        <EmptyState
          title="Tidak ada antrean"
          description="Belum ada tiket antrean pada site ini."
          icon={ListOrdered}
        />
      )}

      {!loading && !error && tickets.length > 0 && (
        <div className="space-y-3">
          {tickets.map((ticket) => {
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
                        <p className="font-medium text-slate-900">{patientName}</p>
                        <p className="text-xs text-slate-500">
                          MRN: {mrn} · {ticket.appointment?.visit_type ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500">
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
