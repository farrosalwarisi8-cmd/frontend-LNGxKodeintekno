"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import {
  notificationService,
  type BackendNotification,
} from "@/lib/services/notification.service";
import {
  Bell,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  QUEUED: "warning",
  SENT: "info",
  FAILED: "danger",
  READ: "success",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  QUEUED: Clock,
  SENT: CheckCircle,
  FAILED: XCircle,
  READ: CheckCircle,
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  EMAIL: Mail,
  WHATSAPP: MessageSquare,
  SMS: MessageSquare,
  PUSH: Bell,
};

interface DeliveryInfo {
  channel?: string;
  status?: string;
  sent_at?: string | null;
  error?: string | null;
}

export default function NotificationsPage() {
  const user = useStore((s) => s.currentUserId);
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationService.getAll();
      // Filter for current user
      const mine = data.filter((n) => n.user_id === user);
      setNotifications(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat notifikasi.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "READ" } : n))
      );
    } catch {
      // silent fail
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifikasi Saya</h1>
          <p className="text-sm text-muted-foreground">
            Riwayat notifikasi dan status pengiriman (email/WhatsApp)
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Gagal memuat notifikasi" message={error} onRetry={load} />
      )}

      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          title="Belum ada notifikasi"
          description="Notifikasi akan muncul setelah ada aktivitas sistem."
          icon={Bell}
        />
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((n) => {
            const StatusIcon = STATUS_ICON[n.status] ?? Clock;
            const isExpanded = expandedId === n.id;
            const deliveries = (n.deliveries ?? []) as DeliveryInfo[];

            return (
              <Card key={n.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <StatusIcon className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {n.template?.subject_template ?? "Notifikasi"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(n.created_at ?? "")}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[n.status] ?? "default"}>
                          <StatusIcon className="mr-1 size-3" />
                          {n.status}
                        </Badge>
                        {n.template?.channel && (
                          <Badge variant="default">
                            {(() => {
                              const ChannelIcon = CHANNEL_ICON[n.template.channel] ?? Bell;
                              return <ChannelIcon className="mr-1 size-3" />;
                            })()}
                            {n.template.channel}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.status !== "READ" && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkRead(n.id)}>
                        Tandai dibaca
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId(isExpanded ? null : n.id)}
                    >
                      {isExpanded ? "Tutup" : "Detail"}
                    </Button>
                  </div>
                </div>

                {/* Expanded delivery details */}
                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    {/* Message body */}
                    {n.template?.body_template && (
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-xs font-medium text-text-secondary">Pesan:</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {n.template.body_template}
                        </p>
                      </div>
                    )}

                    {/* Delivery attempts */}
                    {deliveries.length > 0 && (
                      <div className="rounded-xl border border-border p-3">
                        <p className="text-xs font-medium text-text-secondary">
                          Riwayat Pengiriman ({deliveries.length} attempt):
                        </p>
                        <div className="mt-2 space-y-2">
                          {deliveries.map((d, i) => {
                            const ChannelIcon = CHANNEL_ICON[d.channel ?? ""] ?? Bell;
                            return (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <ChannelIcon className="size-3.5 text-muted-foreground" />
                                  <span className="font-medium text-text-secondary">
                                    {d.channel ?? "unknown"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={STATUS_VARIANT[d.status ?? ""] ?? "default"}
                                  >
                                    {d.status}
                                  </Badge>
                                  {d.sent_at && (
                                    <span className="text-muted-foreground">
                                      {formatDate(d.sent_at)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Related entity */}
                    {n.related_type && (
                      <p className="text-xs text-muted-foreground">
                        Related: {n.related_type} #{n.related_id?.slice(0, 8)}
                      </p>
                    )}

                    {/* Failure reason */}
                    {deliveries.some((d) => d.error) && (
                      <div className="rounded-xl bg-danger-50 p-3 text-xs text-danger-700">
                        <p className="font-medium">Error:</p>
                        {deliveries
                          .filter((d) => d.error)
                          .map((d, i) => (
                            <p key={i} className="mt-1">
                              [{d.channel}] {d.error}
                            </p>
                          ))}
                      </div>
                    )}
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
