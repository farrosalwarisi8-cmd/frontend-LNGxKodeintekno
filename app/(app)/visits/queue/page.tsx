"use client";

import { Can, useCan } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/shared/components/design-system/card";
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
import { useI18n } from "@/lib/i18n";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  WAITING: "warning",
  CALLED: "info",
  IN_SERVICE: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  WAITING: "queue.status.waiting",
  CALLED: "queue.status.called",
  IN_SERVICE: "queue.status.inService",
  COMPLETED: "queue.status.completed",
  CANCELLED: "queue.status.cancelled",
};

export default function QueuePage() {
  const { t: translate } = useI18n();
  const can = useCan();
  const isClinicAdmin = can("visits.call-ticket") && !can("visits.view-clinical");
  const [tickets, setTickets] = useState<BackendQueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const siteId = useStore((s) => s.activeSiteId);
  const scopeVersion = useStore((s) => s.scopeVersion);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    // Polling memakai mode silent agar daftar tidak berkedip/skeleton tiap 15 detik.
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await encounterService.getQueues(siteId ?? undefined);
      setTickets(data ?? []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : translate("queue.loadError"));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [siteId, translate]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load, scopeVersion]);

  // Antrean diperbarui otomatis tiap 15 detik selama tab terlihat.
  useEffect(() => {
    const POLL_MS = 15_000;
    const interval = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void load({ silent: true });
      }
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const handleCallTicket = async (ticketId: string, counterId?: string) => {
    setCallingId(ticketId);
    setCallError(null);
    try {
      await encounterService.callNextTicket(counterId ?? "counter-1", ticketId);
      await load();
    } catch (e) {
      setCallError(e instanceof Error ? e.message : translate("queue.callError"));
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
          <h1 className="text-2xl font-semibold text-foreground">{translate("page.visitsQueue.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {translate("page.visitsQueue.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground" role="status">
              Terakhir diperbarui ·{" "}
              {lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Can action="visits.call-ticket">
            <Button
              onClick={() =>
                nextWaiting && handleCallTicket(nextWaiting.id, nextWaiting.counter_id ?? undefined)
              }
              disabled={!nextWaiting || callingId !== null}
              loading={callingId === nextWaiting?.id && callingId !== null}
            >
              <PhoneCall className="size-4" />
              {translate("queue.callNext")}
              {nextWaiting ? ` (#${nextWaiting.ticket_no})` : ""}
            </Button>
          </Can>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <ListOrdered className="size-4" />
            {translate("queue.refresh")}
          </Button>
        </div>
      </div>

      {callError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {callError}
        </div>
      )}

      {isClinicAdmin && (
        <p className="text-sm text-muted-foreground" role="status">
          Field klinis dibatasi untuk role Admin Klinik.
        </p>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder={translate("queue.searchPlaceholder")}
              aria-label={translate("queue.searchAria")}
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              leftIcon={<Search />}
            />
          </div>
          <Button
            variant={waitingOnly ? "primary" : "outline"}
            aria-pressed={waitingOnly}
            size="sm"
            onClick={() => setFilter("waitingOnly", waitingOnly ? "0" : "1")}
          >
            <Clock className="size-4" />
            {translate("queue.onlyWaiting")} ({waiting.length})
          </Button>
          {filterActive && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="size-4" />
              {translate("queue.resetFilter")}
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
              <p className="text-xs text-muted-foreground">
                {translate("queue.status.waiting")}
              </p>
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
              <p className="text-xs text-muted-foreground">
                {translate("queue.status.inService")}
              </p>
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
              <p className="text-xs text-muted-foreground">
                {translate("queue.status.completed")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <ErrorState title={translate("queue.errorTitle")} message={error} onRetry={load} />
      )}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <EmptyState
          title={
            tickets.length === 0
              ? translate("queue.empty.noQueue")
              : translate("queue.empty.noMatch")
          }
          description={
            tickets.length === 0
              ? translate("queue.empty.noQueueDesc")
              : translate("queue.empty.noMatchDesc")
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
                          {translate("queue.mrnLabel")}: {mrn} · {ticket.appointment?.visit_type ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ticket.appointment?.scheduled_at
                            ? formatDate(ticket.appointment.scheduled_at)
                            : ""}
                          {ticket.counter
                            ? ` · ${translate("queue.counterLabel")} ${ticket.counter.name}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusMeta}>
                      {STATUS_LABEL_KEY[ticket.status]
                        ? translate(STATUS_LABEL_KEY[ticket.status])
                        : ticket.status}
                    </Badge>
                    <Can action="visits.call-ticket">
                      {ticket.status === "WAITING" && (
                        <Button
                          size="sm"
                          onClick={() => handleCallTicket(ticket.id, ticket.counter_id ?? undefined)}
                          disabled={callingId === ticket.id}
                        >
                          <PhoneCall className="size-3.5" />
                          {callingId === ticket.id
                            ? translate("queue.calling")
                            : translate("queue.call")}
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
