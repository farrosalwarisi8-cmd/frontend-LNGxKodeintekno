"use client";

/**
 * TTE Monitoring — pemantauan notifikasi & template pesan:
 *   GET  /api/v1/notifications                     (notifikasi milik user)
 *   PUT  /api/v1/notifications/:id/read
 *   GET  /api/v1/admin/notification-templates      (SYSTEM_ADMIN)
 *   POST /api/v1/admin/notification-templates      (SYSTEM_ADMIN)
 *   POST /api/v1/admin/escalation/run-check        (SYSTEM_ADMIN)
 *
 * Endpoint tanda tangan elektronik (PSrE/PTTE) ada di halaman Dokumen &
 * Tanda Tangan; halaman ini memantau jalur notifikasi/escalation yang
 * mengiringi penerbitan dokumen.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  notificationService,
  type BackendNotification,
  type BackendNotificationTemplate,
} from "@/lib/services/notification.service";
import { Bell, Plus, RefreshCw, Send, Mail, MessageSquare } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  QUEUED: "warning",
  SENT: "success",
  FAILED: "danger",
  READ: "info",
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Menunggu",
  SENT: "Terkirim",
  FAILED: "Gagal",
  READ: "Dibaca",
};

/** Channel notifikasi yang didukung backend (NotificationChannel). */
const CHANNELS = ["EMAIL", "SMS", "IN_APP", "WHATSAPP"];

const EMPTY_TEMPLATE = {
  code: "",
  channel: "EMAIL",
  subjectTemplate: "",
  bodyTemplate: "",
};

export default function TteMonitoringPage() {
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [templates, setTemplates] = useState<BackendNotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_TEMPLATE });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [notifs, tpls] = await Promise.allSettled([
        notificationService.getAll(),
        notificationService.getTemplates(),
      ]);
      setNotifications(notifs.status === "fulfilled" ? notifs.value : []);
      // Template khusus SYSTEM_ADMIN: kegagalan di sini berarti role tanpa
      // izin, bukan halaman mati — notifikasi tetap tampil.
      setTemplates(tpls.status === "fulfilled" ? tpls.value : []);
      if (notifs.status === "rejected") {
        setError(
          notifs.reason instanceof Error
            ? notifs.reason.message
            : "Gagal memuat notifikasi."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const handleMarkRead = async (id: string) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await notificationService.markAsRead(id);
      setActionMsg("Notifikasi ditandai sudah dibaca.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menandai notifikasi.");
    }
  };

  const handleCreateTemplate = async () => {
    setActionError(null);
    setActionMsg(null);
    if (!formData.code.trim() || !formData.subjectTemplate.trim() || !formData.bodyTemplate.trim()) {
      setActionError("Kode, subjek, dan isi template wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      await notificationService.createTemplate({
        code: formData.code.trim(),
        channel: formData.channel,
        subjectTemplate: formData.subjectTemplate.trim(),
        bodyTemplate: formData.bodyTemplate.trim(),
      });
      setShowModal(false);
      setFormData({ ...EMPTY_TEMPLATE });
      setActionMsg("Template notifikasi tersimpan.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan template.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunEscalation = async () => {
    setEscalating(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const res = await notificationService.runEscalationCheck();
      const evaluated = res?.evaluatedCount ?? 0;
      const escalated = res?.escalatedCount ?? 0;
      setActionMsg(
        `Pemeriksaan eskalasi selesai: ${evaluated} dievaluasi, ${escalated} dieskalasi.`
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menjalankan pemeriksaan eskalasi.");
    } finally {
      setEscalating(false);
    }
  };

  const unreadCount = notifications.filter((n) => n.status !== "READ").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Monitoring Notifikasi</h1>
          <p className="text-sm text-muted-foreground">
            Notifikasi pengingat MCU, template pesan, dan eskalasi otomatis
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Can action="escalation.run">
            <Button variant="outline" onClick={handleRunEscalation} disabled={escalating}>
              <Send className="size-4" />
              {escalating ? "Menjalankan..." : "Jalankan Eskalasi"}
            </Button>
          </Can>
          <Can action="system-config.manage">
            <Button
              onClick={() => {
                setActionError(null);
                setActionMsg(null);
                setShowModal(true);
              }}
            >
              <Plus className="size-4" />
              Template Baru
            </Button>
          </Can>
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700">{actionMsg}</div>
      )}
      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-600">
              <Bell className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{notifications.length}</p>
              <p className="text-xs text-muted-foreground">Total Notifikasi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Bell className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{unreadCount}</p>
              <p className="text-xs text-muted-foreground">Belum Dibaca</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">{templates.length}</p>
              <p className="text-xs text-muted-foreground">Template Pesan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifikasi */}
      <h2 className="text-sm font-semibold text-foreground">Notifikasi Saya</h2>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Gagal memuat notifikasi" message={error} onRetry={load} />
      )}

      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          title="Belum ada notifikasi"
          description="Notifikasi pengingat MCU akan muncul di sini."
          icon={Bell}
        />
      )}

      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[n.status] ?? "default"}>
                      {STATUS_LABEL[n.status] ?? n.status}
                    </Badge>
                    {n.template?.code && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {n.template.code}
                      </span>
                    )}
                    {n.related_type && (
                      <span className="text-xs text-muted-foreground">
                        · {n.related_type}
                      </span>
                    )}
                  </div>
                  {n.template?.subject_template && (
                    <p className="text-sm font-medium text-foreground">
                      {n.template.subject_template}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Dibuat {formatDate(n.created_at ?? n.scheduled_at ?? "")}
                  </p>
                </div>
                {n.status !== "READ" && (
                  <Button variant="outline" size="sm" onClick={() => handleMarkRead(n.id)}>
                    Tandai Dibaca
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Template */}
      <h2 className="text-sm font-semibold text-foreground">Template Pesan</h2>
      {templates.length === 0 ? (
        <EmptyState
          title="Template tidak tersedia"
          description="Daftar template hanya dapat dilihat System Administrator."
          icon={MessageSquare}
        />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.code ?? t.id} className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{t.code}</p>
                    {t.channel && <Badge variant="default">{t.channel}</Badge>}
                  </div>
                  {t.subject_template && (
                    <p className="text-sm text-foreground">{t.subject_template}</p>
                  )}
                  {t.body_template && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {t.body_template}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal open onClose={() => setShowModal(false)} title="Template Notifikasi Baru">
          <div className="space-y-3">
            <Input
              label="Kode Template"
              value={formData.code}
              onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value }))}
              placeholder="MCU_REMINDER_H30"
            />
            <Select
              label="Channel"
              value={formData.channel}
              onChange={(e) => setFormData((f) => ({ ...f, channel: e.target.value }))}
              options={CHANNELS.map((c) => ({ value: c, label: c }))}
            />
            <Input
              label="Subjek"
              value={formData.subjectTemplate}
              onChange={(e) =>
                setFormData((f) => ({ ...f, subjectTemplate: e.target.value }))
              }
              placeholder="Pengingat MCU - {{nama}}"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Isi Pesan
              </label>
              <textarea
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                rows={5}
                value={formData.bodyTemplate}
                onChange={(e) => setFormData((f) => ({ ...f, bodyTemplate: e.target.value }))}
                placeholder="MCU Anda akan berakhir pada {{tanggal}}."
              />
            </div>
            {actionError && <p className="text-xs text-danger-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button onClick={handleCreateTemplate} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
