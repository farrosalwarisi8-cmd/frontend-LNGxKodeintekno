"use client";

/**
 * EI-05 — Riwayat kesehatan pada profil pekerja.
 *
 * Sumber data adalah store hasil sinkronisasi backend (bukan seed):
 * MCU (`/mcu/cycles`), kunjungan (`/clinic/queues`), status kesehatan kerja
 * (assessment FTW), dan sertifikat (`/documents?documentType=FTW_CERTIFICATE`).
 * Setiap sumber hanya dimuat bila peran punya izinnya; detail klinis kunjungan
 * (keluhan/diagnosis) hanya untuk pemegang `view-clinical-notes`.
 */
import { useMemo } from "react";
import { Activity, BadgeCheck, ClipboardList, HeartPulse } from "lucide-react";
import { can as hasPermission, type Permission } from "@/lib/rbac";
import { useDemoMode } from "@/lib/demo-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/lib/store";
import {
  syncCertificates,
  syncMcu,
  syncQueues,
  syncWorkHealthStatus,
  useSyncedModules,
} from "@/lib/remote-sync";
import { formatDate } from "@/shared/utils/date";
import type { CertificateStatus, HealthStatus, MCUStatus, VisitStatus } from "@/lib/types";

function statusVariant(status: HealthStatus): "success" | "warning" | "danger" | "outline" {
  switch (status) {
    case "Fit to Work":
      return "success";
    case "Fit with Restriction":
    case "Pending Further Evaluation":
      return "warning";
    case "Temporarily Unfit":
    case "Unfit":
      return "danger";
    default:
      return "outline";
  }
}

function certificateVariant(status: CertificateStatus): "success" | "warning" | "danger" | "outline" {
  if (status === "valid") return "success";
  if (status === "expired") return "warning";
  if (status === "revoked") return "danger";
  return "outline";
}

export function HealthTimeline({ patientId }: { patientId: string }) {
  const { role } = useDemoMode();
  const can = (permission: Permission) => (role ? hasPermission(role, permission) : false);
  const showMcu = can("view-mcu");
  const showVisits = can("view-visits");
  const showClinical = can("view-clinical-notes");
  const showStatus = can("view-health-status");
  const showCertificates = can("issue-certificate");

  const mcus = useStore((s) => s.mcus);
  const visits = useStore((s) => s.visits);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const certificates = useStore((s) => s.certificates);

  const { loading, error, refetch } = useSyncedModules(async () => {
    const tasks: Array<Promise<unknown>> = [];
    if (showMcu) tasks.push(syncMcu(1, 100));
    if (showVisits) tasks.push(syncQueues());
    if (showStatus) tasks.push(syncWorkHealthStatus());
    if (showCertificates) tasks.push(syncCertificates(1, 100));
    if (tasks.length === 0) return;

    // Satu sumber yang ditolak backend tidak boleh mengosongkan seluruh tab.
    const results = await Promise.allSettled(tasks);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    if (rejected.length === results.length) throw rejected[0].reason;
  });

  const personMcus = useMemo(
    () => mcus.filter((m) => m.employeeId === patientId),
    [mcus, patientId]
  );
  const personVisits = useMemo(
    () => visits.filter((v) => v.employeeId === patientId),
    [visits, patientId]
  );
  const personCertificates = useMemo(
    () => certificates.filter((c) => c.employeeId === patientId),
    [certificates, patientId]
  );
  const latestStatus = useMemo(() => {
    const rows = workHealthStatus
      .filter((w) => w.employeeId === patientId)
      .sort((a, b) => String(b.decisionDate).localeCompare(String(a.decisionDate)));
    return rows[0];
  }, [workHealthStatus, patientId]);

  if (!showMcu && !showVisits && !showStatus && !showCertificates) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Peran Anda tidak memiliki akses ke riwayat kesehatan pekerja ini.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
          Sebagian riwayat tidak dapat dimuat: {error}.{" "}
          <button type="button" className="underline underline-offset-2" onClick={refetch}>
            Coba lagi
          </button>
        </div>
      )}

      {showStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="size-4 text-muted-foreground" aria-hidden="true" />
              Status Kesehatan Kerja
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestStatus ? (
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(latestStatus.status)}>{latestStatus.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Keputusan {formatDate(latestStatus.decisionDate)}
                  </span>
                </div>
                <p>
                  <span className="text-muted-foreground">Berlaku:</span>{" "}
                  {formatDate(latestStatus.validFrom)} – {formatDate(latestStatus.validUntil)}
                </p>
                {latestStatus.restriction && (
                  <p>
                    <span className="text-muted-foreground">Restriksi:</span>{" "}
                    {latestStatus.restriction}
                    {latestStatus.reviewDate ? ` (review ${formatDate(latestStatus.reviewDate)})` : ""}
                  </p>
                )}
                {latestStatus.recommendation && (
                  <p>
                    <span className="text-muted-foreground">Rekomendasi kerja:</span>{" "}
                    {latestStatus.recommendation}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada keputusan status kesehatan kerja.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showMcu && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
              Riwayat MCU
            </CardTitle>
          </CardHeader>
          <CardContent>
            {personMcus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada siklus MCU.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {personMcus.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium text-foreground">{m.mcuNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.type} · {formatDate(m.examDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.decision && <Badge variant={statusVariant(m.decision)}>{m.decision}</Badge>}
                      <Badge variant="outline">{m.status as MCUStatus}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {showVisits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
              Riwayat Kunjungan Klinik
            </CardTitle>
          </CardHeader>
          <CardContent>
            {personVisits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada kunjungan klinik.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {personVisits.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium text-foreground">{v.visitNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.date)} · {v.status as VisitStatus}
                      </p>
                      {/* Detail klinis hanya untuk pemegang view-clinical-notes. */}
                      {showClinical && v.chiefComplaint && (
                        <p className="text-xs text-muted-foreground">Keluhan: {v.chiefComplaint}</p>
                      )}
                    </div>
                    {v.recordStatus === "LOCKED" && <Badge variant="outline">Rekam medis terkunci</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {showCertificates && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              Sertifikat Kesehatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {personCertificates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada sertifikat diterbitkan.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {personCertificates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium text-foreground">{c.certNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Terbit {formatDate(c.issuedAt)} · berlaku sampai {formatDate(c.validUntil)}
                      </p>
                    </div>
                    <Badge variant={certificateVariant(c.status)}>{c.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
