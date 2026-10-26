"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { syncCertificates, syncMcu, syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { findMyEmployee } from "@/lib/services/auth.service";
import { CERT_STATUS } from "@/lib/constants";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { BadgeCheck, QrCode } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Sertifikat Saya</h1>
      <p className="text-sm text-muted-foreground">Sertifikat kesehatan kerja</p>
    </div>
  );
}

export default function MyCertificatesPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const certificates = useStore((s) => s.certificates);

  // Modul 9 — sertifikat kesehatan dari backend (turunan siklus MCU +
  // dokumen FTW_CERTIFICATE dengan QR verifikasi publik).
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await Promise.all([syncMcu(1, 100), syncCertificates(1, 100)]);
  });

  if (!user) return null;

  const employee = findMyEmployee(employees, user);
  if (!employee) {
    return (
      <div className="space-y-4">
        <PageTitle />
        <EmptyState
          icon={BadgeCheck}
          title="Belum ada sertifikat untuk akun ini"
          description="Akun Anda belum tertaut ke data pekerja (MPI), sehingga sertifikat belum bisa ditampilkan."
          action={
            <Link href="/my/profile">
              <Button variant="outline" size="sm">Buka Profil Saya</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const myCerts = certificates.filter((c) => c.employeeId === employee.id);

  return (
    <div className="space-y-4">
      <PageTitle />

      {error && (
        <ErrorState
          title="Gagal memuat sertifikat"
          message={error}
          onRetry={refetch}
        />
      )}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!loading && !error && myCerts.length === 0 && (
        <EmptyState
          icon={BadgeCheck}
          title="Belum ada sertifikat"
          description="Sertifikat kesehatan kerja Anda akan tampil di sini setelah diterbitkan dokter."
        />
      )}

      {!loading && !error && myCerts.length > 0 && (
        <div className="space-y-3">
          {myCerts.map((cert) => {
            const statusMeta = CERT_STATUS[cert.status];
            return (
              <Card key={cert.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                      <BadgeCheck className="size-6" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{cert.certNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert.healthStatus} · Berlaku s.d. {formatDate(cert.validUntil)}
                      </p>
                      {cert.restrictions && (
                        <p className="text-xs text-warning-600">Restriction: {cert.restrictions}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge meta={statusMeta} />
                    {cert.qrToken && (
                      <Link href={`/verify/${encodeURIComponent(cert.qrToken)}`} target="_blank">
                        <Badge variant="info" className="cursor-pointer">
                          <QrCode className="size-3" />
                          QR
                        </Badge>
                      </Link>
                    )}
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
