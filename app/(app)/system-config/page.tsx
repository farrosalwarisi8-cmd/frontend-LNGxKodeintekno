"use client";

/**
 * Konfigurasi Sistem — endpoint backend Domain 1 & observability:
 *   GET/POST/PUT/DELETE /api/v1/admin/settings   (SYSTEM_ADMIN untuk tulis)
 *   POST /api/v1/admin/settings/reset-defaults   (SYSTEM_ADMIN)
 *   GET  /api/v1/metrics/json|queue|alerts       (SYSTEM_ADMIN, HSE_MANAGER)
 *
 * Body setting memakai snake_case (`setting_key`, `setting_value`) sesuai DTO
 * backend — beda dari mayoritas DTO lain, jadi konversi dilakukan eksplisit.
 */

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import {
  systemService,
  type BackendSystemSetting,
} from "@/lib/services/system.service";
import {
  Settings,
  Plus,
  RotateCcw,
  Activity,
  AlertTriangle,
  Server,
} from "lucide-react";

export default function SystemConfigPage() {
  const [settings, setSettings] = useState<BackendSystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("{}");
  const [formVersion, setFormVersion] = useState("");
  const [valueError, setValueError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Observability (metrik, worker, alert) — read-only, role terbatas.
  const [metrics, setMetrics] = useState<Array<{ name: string; value: number }>>([]);
  const [alerts, setAlerts] = useState<unknown[]>([]);
  const [obsError, setObsError] = useState<string | null>(null);
  const [loadingObs, setLoadingObs] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemService.listSettings({ page: 1, limit: 50 });
      setSettings(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat konfigurasi sistem.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadObservability = useCallback(async () => {
    setLoadingObs(true);
    setObsError(null);
    try {
      const [metricsRes, alertsRes] = await Promise.allSettled([
        systemService.getMetrics(),
        systemService.getAlerts(),
      ]);
      if (metricsRes.status === "fulfilled") {
        setMetrics(
          metricsRes.value
            .filter((m): m is { name: string; value: number } => Boolean(m?.name))
            .map((m) => ({ name: m.name, value: Number(m.value ?? 0) }))
            .slice(0, 12)
        );
      }
      if (alertsRes.status === "fulfilled") {
        setAlerts(alertsRes.value ?? []);
      }
      // Kegagalan sebagian (mis. role tanpa izin metrik) tidak mengosongkan
      // halaman — hanya menandai bahwa panel observability tidak lengkap.
      if (metricsRes.status === "rejected" && alertsRes.status === "rejected") {
        setObsError("Metrik operasional tidak tersedia untuk peran Anda.");
      }
    } finally {
      setLoadingObs(false);
    }
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan halaman lain.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => void loadObservability(), 0);
    return () => clearTimeout(timer);
  }, [loadObservability]);

  const handleSubmit = async () => {
    setActionError(null);
    setActionMsg(null);
    setValueError(null);
    if (!formKey.trim()) {
      setActionError("Kunci setting wajib diisi.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(formValue);
    } catch {
      setValueError("Nilai harus berupa JSON yang valid (mis. {\"maxFailedLoginAttempts\": 5}).");
      return;
    }
    setSaving(true);
    try {
      await systemService.createSetting({
        setting_key: formKey.trim(),
        setting_value: parsed,
        version: formVersion.trim() || undefined,
      });
      setShowModal(false);
      setFormKey("");
      setFormValue("{}");
      setFormVersion("");
      setActionMsg("Konfigurasi tersimpan.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await systemService.deleteSetting(key);
      setActionMsg(`Konfigurasi "${key}" dihapus.`);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal menghapus konfigurasi.");
    }
  };

  const handleResetDefaults = async () => {
    setActionError(null);
    setActionMsg(null);
    try {
      await systemService.resetDefaults();
      setActionMsg("Konfigurasi dikembalikan ke nilai default.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal mereset konfigurasi.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Konfigurasi Sistem</h1>
          <p className="text-sm text-muted-foreground">
            Konfigurasi dinamis backend dan kesehatan operasional
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can action="system-config.manage">
            <Button variant="outline" onClick={handleResetDefaults}>
              <RotateCcw className="size-4" />
              Reset Default
            </Button>
            <Button
              onClick={() => {
                setActionError(null);
                setActionMsg(null);
                setValueError(null);
                setShowModal(true);
              }}
            >
              <Plus className="size-4" />
              Tambah Setting
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

      {/* Daftar setting */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && error && (
        <ErrorState title="Gagal memuat konfigurasi" message={error} onRetry={load} />
      )}

      {!loading && !error && settings.length === 0 && (
        <EmptyState
          title="Belum ada konfigurasi"
          description="Belum ada setting tersimpan di backend."
          icon={Settings}
        />
      )}

      {!loading && !error && settings.length > 0 && (
        <div className="space-y-3">
          {settings.map((setting) => (
            <Card key={setting.setting_key} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{setting.setting_key}</p>
                    {setting.version && (
                      <Badge variant="default">v{setting.version}</Badge>
                    )}
                  </div>
                  <pre className="max-h-32 overflow-auto rounded-lg bg-muted p-2 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(setting.setting_value, null, 2)}
                  </pre>
                  {setting.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Diperbarui {formatDate(setting.updated_at)}
                    </p>
                  )}
                </div>
                <Can action="system-config.manage">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(setting.setting_key)}
                  >
                    Hapus
                  </Button>
                </Can>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Observability */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Metrik Aplikasi</h2>
          </div>
          {loadingObs && <Skeleton className="mt-3 h-20 w-full" />}
          {!loadingObs && obsError && metrics.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{obsError}</p>
          )}
          {!loadingObs && metrics.length > 0 && (
            <dl className="mt-3 space-y-1 text-xs">
              {metrics.map((m) => (
                <div key={m.name} className="flex justify-between gap-2">
                  <dt className="truncate font-mono text-muted-foreground">{m.name}</dt>
                  <dd className="font-medium text-foreground">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Alert Operasional ({alerts.length})
            </h2>
          </div>
          {loadingObs && <Skeleton className="mt-3 h-20 w-full" />}
          {!loadingObs && alerts.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Tidak ada alert aktif.
            </p>
          )}
          {!loadingObs && alerts.length > 0 && (
            <ul className="mt-3 space-y-2 text-xs">
              {alerts.map((alert, i) => {
                const a = alert as Record<string, unknown>;
                const severity = String(a.severity ?? "UNKNOWN");
                const message = String(a.message ?? a.title ?? "Alert");
                return (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-foreground">{message}</span>
                    <Badge
                      variant={
                        severity === "CRITICAL" || severity === "HIGH"
                          ? "danger"
                          : severity === "MEDIUM"
                            ? "warning"
                            : "default"
                      }
                    >
                      {severity}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Server className="mt-0.5 size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Metrik dan alert hanya dapat dilihat System Administrator dan HSE Manager.
            Perubahan konfigurasi tercatat di audit log backend.
          </p>
        </div>
      </Card>

      {showModal && (
        <Modal open onClose={() => setShowModal(false)} title="Tambah Setting Sistem">
          <div className="space-y-3">
            <Input
              label="Kunci Setting"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
              placeholder="AUTH_SECURITY_POLICY"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Nilai (JSON)
              </label>
              <textarea
                className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs"
                rows={6}
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
              {valueError && <p className="mt-1 text-xs text-danger-600">{valueError}</p>}
            </div>
            <Input
              label="Versi (opsional)"
              value={formVersion}
              onChange={(e) => setFormVersion(e.target.value)}
              placeholder="1.0"
            />
            {actionError && <p className="text-xs text-danger-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
