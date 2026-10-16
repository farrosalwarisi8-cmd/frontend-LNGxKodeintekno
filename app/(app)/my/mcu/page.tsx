"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { useEffect, useState } from "react";
import { MCU_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { Activity, HeartPulse } from "lucide-react";

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">MCU Saya</h1>
      <p className="text-sm text-slate-500">Riwayat Medical Check-Up</p>
    </div>
  );
}

export default function MyMCUPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (!user) return null;

  const employee = employees.find((e) => e.employeeId === user.employeeId);
  if (!employee) {
    return (
      <div className="space-y-4">
        <PageTitle />
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <ErrorState title="Gagal memuat data MCU" message={error} onRetry={() => setError(null)} />
        ) : (
          <EmptyState
            icon={Activity}
            title="Data MCU tidak ditemukan"
            description="Akun Anda belum tertaut ke data pekerja, sehingga riwayat MCU belum bisa ditampilkan."
          />
        )}
      </div>
    );
  }

  const myMCUs = mcus.filter((m) => m.employeeId === employee.id);
  const myHealthStatus = workHealthStatus.filter((w) => w.employeeId === employee.id);

  return (
    <div className="space-y-4">
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {!loading && !error && (
        <>
          <PageTitle />

          {myHealthStatus.length > 0 && (
            <Card className="border-success-200 bg-success-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HeartPulse className="size-5 text-success-600" />
                  Status Kesehatan Kerja Saat Ini
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myHealthStatus.map((whs) => (
                  <div key={whs.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          whs.status === "Fit to Work"
                            ? "success"
                            : whs.status === "Fit with Restriction"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {whs.status}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        Berlaku s.d. {formatDate(whs.validUntil)}
                      </span>
                    </div>
                    {whs.restriction && (
                      <p className="text-sm text-warning-600">Restriction: {whs.restriction}</p>
                    )}
                    {whs.recommendation && (
                      <p className="text-sm text-slate-600">Rekomendasi: {whs.recommendation}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {myMCUs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Belum ada riwayat MCU"
                description="Riwayat Medical Check-Up Anda akan tampil di sini setelah pemeriksaan pertama selesai."
              />
            ) : (
              myMCUs.map((mcu) => {
                const statusMeta = MCU_STATUS[mcu.status];
                return (
                  <Card key={mcu.id} className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{mcu.mcuNumber}</p>
                        <p className="text-xs text-slate-500">
                          {mcu.type} · {formatDate(mcu.examDate)} · {mcu.facility}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline" className={statusMeta?.color}>
                            {statusMeta?.label}
                          </Badge>
                          {mcu.decision && (
                            <span className="text-xs text-slate-500">{mcu.decision}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        {mcu.validFrom && (
                          <p>
                            Berlaku: {formatDate(mcu.validFrom)} — {formatDate(mcu.validUntil)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
