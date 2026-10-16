"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { syncNotifications, useSyncedModules } from "@/lib/remote-sync";
import { notificationService } from "@/lib/services/notification.service";
import {
  formatBadgeCount,
  notificationsForUser,
  unreadCount,
} from "@/lib/notification-utils";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FetchState = "idle" | "loading" | "error";

/**
 * Bell notifikasi untuk shell internal.
 *
 * - Mengambil data sekali saat mount via `syncNotifications()`
 *   (GET /notifications — endpoint backend existing, tanpa endpoint baru).
 * - Panel: loading / error+retry / empty / daftar + mark-as-read (optimis,
 *   rollback bila API gagal).
 * - Desktop: dropdown; mobile: bottom sheet full-width.
 */
export function NotificationBell() {
  const user = useCurrentUser();
  const notifications = useStore((s) => s.notifications);
  const markReadStore = useStore((s) => s.markNotificationRead);
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch sekali saat shell mount (bukan setiap ganti route) —
  // pola repository `useSyncedModules` (loading/error/refetch).
  const { loading, error, refetch } = useSyncedModules(() => syncNotifications());
  const fetchState: FetchState = loading ? "loading" : error ? "error" : "idle";

  const mine = notificationsForUser(notifications, user?.id ?? null);
  const unread = unreadCount(notifications, user?.id ?? null);
  const badge = formatBadgeCount(unread);

  // Escape menutup panel + kembalikan fokus ke trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const retry = () => refetch();

  const handleMarkRead = (id: string) => {
    if (!user) return;
    const before = useStore.getState().notifications;
    markReadStore(id); // optimis
    setActionError(null);
    notificationService.markAsRead(id).catch(() => {
      useStore.setState({ notifications: before }); // rollback
      setActionError("Gagal menyimpan. Coba lagi.");
    });
  };

  const handleMarkAllRead = () => {
    if (!user) return;
    const unreadIds = mine.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const before = useStore.getState().notifications;
    unreadIds.forEach((id) => markReadStore(id));
    setActionError(null);
    Promise.all(unreadIds.map((id) => notificationService.markAsRead(id))).catch(() => {
      useStore.setState({ notifications: before }); // rollback penuh
      setActionError("Gagal menyimpan. Coba lagi.");
    });
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notification-panel"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex size-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:size-9",
          open && "bg-slate-100"
        )}
      >
        <Bell className="size-5" aria-hidden="true" />
        {badge && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Daftar notifikasi"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t bg-white p-4 shadow-2xl lg:absolute lg:inset-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-96 lg:w-96 lg:rounded-2xl lg:border"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Notifikasi</h2>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="size-4" /> Tandai semua
              </Button>
            )}
          </div>

          {actionError && (
            <p role="alert" className="mb-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {actionError}
            </p>
          )}

          {fetchState === "loading" && (
            <ul className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </ul>
          )}

          {fetchState === "error" && (
            <div className="py-6 text-center">
              <p className="text-sm text-slate-600">Gagal memuat notifikasi.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                <RefreshCw className="size-4" /> Coba lagi
              </Button>
            </div>
          )}

          {fetchState === "idle" && mine.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Tidak ada notifikasi.</p>
          )}

          {fetchState === "idle" && mine.length > 0 && (
            <ul className="space-y-1">
              {mine.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) handleMarkRead(n.id);
                      setOpen(false);
                      if (n.link) router.push(n.link);
                    }}
                    className={cn(
                      "w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50",
                      !n.read && "bg-primary-50/60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{n.title}</span>
                      {!n.read && (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary-600" aria-label="Belum dibaca" />
                      )}
                    </div>
                    {n.message && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                    )}
                    <time
                      dateTime={n.createdAt}
                      className="mt-1 block text-[11px] text-slate-500"
                      title={formatDateTime(n.createdAt)}
                    >
                      {formatDateTime(n.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
