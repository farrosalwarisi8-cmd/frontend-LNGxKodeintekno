"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { CERT_STATUS } from "@/lib/constants";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { formatDate } from "@/lib/format";
import { BadgeCheck, QrCode } from "lucide-react";
import Link from "next/link";

export default function MyCertificatesPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const certificates = useStore((s) => s.certificates);

  if (!user) return null;

  const employee = employees.find((e) => e.employeeId === user.employeeId);
  if (!employee) {
    return (
      <Card className="p-8 text-center">
        <BadgeCheck className="mx-auto mb-3 size-8 text-slate-300" />
        <p className="text-sm text-slate-500">Sertifikat tidak ditemukan.</p>
      </Card>
    );
  }

  const myCerts = certificates.filter((c) => c.employeeId === employee.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sertifikat Saya</h1>
        <p className="text-sm text-slate-500">Sertifikat kesehatan kerja</p>
      </div>

      {myCerts.length === 0 ? (
        <Card className="p-8 text-center">
          <BadgeCheck className="mx-auto mb-3 size-8 text-slate-300" />
          <p className="text-sm text-slate-500">Belum ada sertifikat.</p>
        </Card>
      ) : (
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
                      <p className="font-medium text-slate-900">{cert.certNumber}</p>
                      <p className="text-xs text-slate-500">
                        {cert.healthStatus} · Berlaku s.d. {formatDate(cert.validUntil)}
                      </p>
                      {cert.restrictions && (
                        <p className="text-xs text-warning-600">Restriction: {cert.restrictions}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusMeta?.color}>
                      {statusMeta?.label}
                    </Badge>
                    <Link href={`/verify/${encodeURIComponent(cert.qrToken)}`} target="_blank">
                      <Badge variant="info" className="cursor-pointer">
                        <QrCode className="size-3" />
                        QR
                      </Badge>
                    </Link>
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
