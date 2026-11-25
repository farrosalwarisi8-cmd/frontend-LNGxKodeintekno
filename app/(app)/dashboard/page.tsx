"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { useDemoMode } from "@/lib/demo-role";
import {
  syncCertificates,
  syncInventory,
  syncMcu,
  syncPatients,
  syncQueues,
  syncWorkHealthStatus,
  useSyncedModules,
} from "@/lib/remote-sync";
import { diagnosticService } from "@/lib/services/diagnostic.service";
import { DEMO_ROLE_LABELS } from "@/lib/demo-role-map";
import { ROLES, MCU_STATUS, VISIT_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Button } from "@/shared/components/design-system/button";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { ICON_MAP, iconFor } from "@/shared/components/icon-map";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import {
  getRoleDashboard,
  getRoleTasks,
  getWorkerHomeLinks,
} from "@/features/dashboard/role-tasks";
import {
  buildTiles,
  computeDashboardMetrics,
  mergeExternalMetric,
  mergePendingPrescriptions,
  openVisits,
} from "@/features/dashboard/dashboard-metrics";
import { pharmacyService } from "@/lib/services/pharmacy.service";
import { StatusBadge } from "@/components/status-badge";
import { useI18n } from "@/lib/i18n";
import { translateDashboardPhrase } from "@/features/dashboard/dashboard-i18n";

const TONE_CLASS: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  success: "bg-success-100 text-success-600",
  warning: "bg-warning-100 text-warning-600",
  danger: "bg-danger-100 text-danger-600",
  info: "bg-info-100 text-info-600",
  // "purple" adalah sisa nada lama tanpa arti semantik; netral agar tidak
  // menambah warna baru di luar peta biru/hijau/merah.
  purple: "bg-muted text-text-secondary",
};

/**
 * Dashboard per peran.
 *
 * Susunannya ditentukan `src/features/dashboard/role-tasks.ts`:
 *  - "Tindakan cepat" = tugas yang paling sering dipakai peran ini, sehingga
 *    tugas harian selesai dalam sedikit klik (bukan mencari di sidebar).
 *  - Kartu angka mengikuti prioritas peran (mis. apoteker melihat resep
 *    menunggu & stok rendah lebih dulu; HSE melihat FTW/restriction).
 *
 * Angka berasal dari data backend yang tersinkron (`lib/remote-sync.ts`);
 * bila data belum ada, ditampilkan 0 atau "—" — bukan angka contoh.
 */
export default function DashboardPage() {
  const user = useCurrentUser();
  const { enabled: demoEnabled, demoRole, role } = useDemoMode();
  const profile = getRoleDashboard(role);
  const tasks = getRoleTasks(role);
  const isWorker = role === "pekerja";
  // Pekerja tidak boleh memicu sinkronisasi data pekerja lain hanya untuk
  // menggambar dashboard-nya.
  const canViewMcu = role ? can(role, "view-mcu") && !isWorker : false;
  const canViewVisits = role ? can(role, "view-visits") : false;
  const canViewClinical = role ? can(role, "view-clinical-notes") : false;

  const { language } = useI18n();
  const tp = (text: string) => translateDashboardPhrase(language, text);

  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const certificates = useStore((s) => s.certificates);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const notifications = useStore((s) => s.notifications);
  const stockBatches = useStore((s) => s.stockBatches);
  const medicines = useStore((s) => s.medicines);
  const activeSiteId = useStore((s) => s.activeSiteId);
  const scopeVersion = useStore((s) => s.scopeVersion);

  // Ringkasan semua modul inti dari backend.
  const { loading, error, refetch } = useSyncedModules(async () => {
    const requests: Promise<unknown>[] = [syncWorkHealthStatus(1, 100)];
    if (canViewMcu) requests.push(syncPatients(1, 100), syncMcu(1, 100));
    if (canViewVisits) requests.push(syncQueues());
    if (role && can(role, "manage-stock")) requests.push(syncInventory());
    // Pekerja membutuhkan sertifikat miliknya sendiri untuk kartu "Sertifikat saya".
    if (role && (can(role, "issue-certificate") || isWorker)) requests.push(syncCertificates(1, 100));
    await Promise.all(requests);
  });

  // Jumlah resep menunggu hanya diambil bila profil peran memang menampilkannya
  // (menghindari request yang tidak terpakai untuk peran lain).
  const wantsPendingPrescriptions = profile.tiles.includes("pendingPrescriptions");
  const [pendingPrescriptions, setPendingPrescriptions] = useState<number | null>(null);

  // Angka lab (order & hasil) diambil dari sumber penunjang yang sudah ada.
  const wantsLabMetrics = profile.tiles.some(
    (key) => key === "labOrdersPending" || key === "labResultsAvailable"
  );
  const [labMetrics, setLabMetrics] = useState<{ orders: number | null; results: number | null }>({
    orders: null,
    results: null,
  });

  useEffect(() => {
    if (!wantsLabMetrics) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.allSettled([
        diagnosticService.listLabOrders(),
        diagnosticService.listLabOrderResults(),
      ]).then(([orders, results]) => {
        if (cancelled) return;
        setLabMetrics({
          orders: orders.status === "fulfilled" ? orders.value.length : null,
          results: results.status === "fulfilled" ? results.value.length : null,
        });
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wantsLabMetrics, activeSiteId, scopeVersion]);

  useEffect(() => {
    if (!wantsPendingPrescriptions) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      pharmacyService
        .getPendingPrescriptions(activeSiteId ?? undefined)
        .then((rows) => {
          if (!cancelled) setPendingPrescriptions(rows.length);
        })
        .catch(() => {
          // Backend tidak tersedia / bukan peran farmasi → tampilkan "—",
          // jangan mengarang angka nol.
          if (!cancelled) setPendingPrescriptions(null);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wantsPendingPrescriptions, activeSiteId, scopeVersion]);

  const tileKeys = profile.tiles;
  const today = new Date().toISOString().slice(0, 10);

  // Perhitungan murni (satu lintasan atas array kecil) — tanpa memo manual;
  // React Compiler yang menangani memoization.
  const metrics = mergeExternalMetric(
    mergeExternalMetric(
      mergePendingPrescriptions(
        computeDashboardMetrics({
          employees,
          mcus,
          visits,
          certificates,
          workHealthStatus,
          medicines,
          stockBatches,
          today,
          currentEmployeeId: user?.employeeId ?? null,
        }),
        wantsPendingPrescriptions ? pendingPrescriptions : null
      ),
      "labOrdersPending",
      wantsLabMetrics ? labMetrics.orders : null
    ),
    "labResultsAvailable",
    wantsLabMetrics ? labMetrics.results : null
  );

  // Susunan kartu murah (hanya beberapa item) — dihitung langsung, tanpa memo,
  // supaya tidak bergantung pada array yang dimiliki modul profil.
  const dashboardTiles = buildTiles(tileKeys, metrics);

  if (!user) return null;

  const roleMeta = role ? ROLES[role] : ROLES[user.role];
  // Pekerja tidak melihat notifikasi sistem (hanya data pribadi).
  const unreadCount = isWorker
    ? 0
    : notifications.filter((n) => n.userId === user.id && !n.read).length;
  const greetingName = demoEnabled ? DEMO_ROLE_LABELS[demoRole] : user.name;
  const recentMCU = canViewMcu ? mcus.slice(0, 5) : [];
  const recentVisits = canViewVisits ? openVisits(visits).slice(0, 5) : [];
  const workerLinks = getWorkerHomeLinks();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {tp("Halo,")} {demoEnabled ? greetingName : greetingName.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {roleMeta?.label ?? user.role} — {tp(profile.focus)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Link
              href="/my/notifications"
              className="flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-700"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
              {unreadCount} {tp("notifikasi")}
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
            {tp("Muat ulang")}
          </Button>
        </div>
      </div>

      {/* Tindakan cepat — pintasan tugas yang paling sering dipakai peran ini. */}
      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <h2 id="quick-actions-heading" className="text-sm font-semibold text-text-secondary">
          {tp("Tindakan cepat")}
        </h2>
        <div
          className={cn(
            "grid gap-3",
            profile.compact ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {tasks.map((task) => {
            const Icon = iconFor(task.icon);
            return (
              <Link
                key={task.href}
                href={task.href}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-foreground">{tp(task.label)}</span>
                  <span className="block text-xs text-muted-foreground">{tp(task.description)}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>

      {error && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-danger-700">
            {tp("Sebagian ringkasan gagal dimuat dari backend")}: {error}
          </p>
          <Button variant="outline" size="sm" onClick={refetch}>
            {tp("Coba lagi")}
          </Button>
        </Card>
      )}

      {/* Kartu angka sesuai prioritas peran. */}
      <div
        className={cn(
          "grid gap-4",
          profile.compact ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}
      >
        {loading && !error
          ? profile.tiles.slice(0, 4).map((key) => <Skeleton key={key} className="h-24 w-full" />)
          : dashboardTiles.map((tile) => {
              const Icon = ICON_MAP[tile.icon] ?? Activity;
              const body = (
                <Card className="h-full transition-colors hover:border-primary-200">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={cn(
                        "flex size-12 shrink-0 items-center justify-center rounded-xl",
                        TONE_CLASS[tile.tone] ?? TONE_CLASS.primary
                      )}
                    >
                      <Icon className="size-6" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-semibold text-foreground">{tile.value}</p>
                      <p className="text-xs text-muted-foreground">{tp(tile.label)}</p>
                    </div>
                  </CardContent>
                </Card>
              );
              return tile.href ? (
                // Tanpa `aria-label` khusus: nama aksesibel diambil dari teks yang
                // terlihat (nilai + label) sehingga tidak menyimpang dari
                // tampilannya (axe `label-content-name-mismatch`).
                <Link key={tile.key} href={tile.href} data-tile={tile.key}>
                  {body}
                </Link>
              ) : (
                <div key={tile.key} data-tile={tile.key}>
                  {body}
                </div>
              );
            })}
      </div>

      {profile.compact ? (
        <section aria-labelledby="my-links-heading" className="space-y-3">
          <h2 id="my-links-heading" className="text-sm font-semibold text-text-secondary">
            {tp("Ruang saya")}
          </h2>
          <div className="grid gap-3">
            {workerLinks.map((link) => {
              const Icon = iconFor(link.icon);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">{tp(link.label)}</span>
                    <span className="block text-xs text-muted-foreground">{tp(link.description)}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {canViewMcu && (
            <Card>
            <CardHeader>
              <CardTitle>{tp("MCU terbaru")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentMCU.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tp("Belum ada data MCU.")}</p>
              ) : (
                <div className="space-y-3">
                  {recentMCU.map((mcu) => {
                    const emp = employees.find((e) => e.id === mcu.employeeId);
                    const statusMeta = MCU_STATUS[mcu.status];
                    return (
                      <div
                        key={mcu.id}
                        className="flex items-center justify-between rounded-xl border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar name={emp?.fullName ?? "?"} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {emp?.fullName ?? tp("Tidak diketahui")}
                            </p>
                            <p className="text-xs text-muted-foreground">{mcu.mcuNumber}</p>
                          </div>
                        </div>
                        <StatusBadge meta={statusMeta} fallback={mcu.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            </Card>
          )}

          {canViewVisits && (
            <Card>
            <CardHeader>
              <CardTitle>{tp("Kunjungan berjalan")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tp("Tidak ada kunjungan berjalan.")}</p>
              ) : (
                <div className="space-y-3">
                  {recentVisits.map((visit) => {
                    const emp = employees.find((e) => e.id === visit.employeeId);
                    const statusMeta = VISIT_STATUS[visit.status];
                    return (
                      <div
                        key={visit.id}
                        className="flex items-center justify-between rounded-xl border border-border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {emp?.fullName ?? visit.visitNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {canViewClinical ? visit.chiefComplaint || visit.visitNumber : visit.visitNumber}
                          </p>
                        </div>
                        <StatusBadge meta={statusMeta} fallback={visit.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
