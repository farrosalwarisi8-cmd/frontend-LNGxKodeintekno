"use client";

import { useStore } from "@/lib/store";
import { VISIT_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Button } from "@/shared/components/design-system/button";
import { formatDate } from "@/lib/format";
import { ListOrdered, UserRound, Clock, CheckCircle } from "lucide-react";

export default function QueuePage() {
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);
  const updateVisit = useStore((s) => s.updateVisit);

  const todayVisits = visits.filter((v) => v.status !== "Completed" && v.status !== "Referred");
  const sorted = [...todayVisits].sort((a, b) => a.queueNumber - b.queueNumber);

  const handleStatusChange = (visitId: string, status: string) => {
    updateVisit(visitId, { status: status as any });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Antrean Klinik</h1>
        <p className="text-sm text-slate-500">Kelola antrean pasien real-time</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <ListOrdered className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{sorted.filter((v) => v.status === "In Queue").length}</p>
              <p className="text-xs text-slate-500">Dalam Antrean</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{sorted.filter((v) => v.status === "In Consultation").length}</p>
              <p className="text-xs text-slate-500">Dalam Konsultasi</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{sorted.filter((v) => v.status === "Completed").length}</p>
              <p className="text-xs text-slate-500">Selesai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-8 text-center">
          <ListOrdered className="mx-auto mb-3 size-8 text-slate-300" />
          <p className="text-sm text-slate-500">Tidak ada antrean saat ini.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((visit, index) => {
            const emp = employees.find((e) => e.id === visit.employeeId);
            const loc = locations.find((l) => l.id === visit.locationId);
            const statusMeta = VISIT_STATUS[visit.status];
            return (
              <Card key={visit.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-lg font-bold text-primary-700">
                      {visit.queueNumber}
                    </div>
                    <div className="flex items-center gap-3">
                      <Avatar name={emp?.fullName ?? "?"} />
                      <div>
                        <p className="font-medium text-slate-900">{emp?.fullName}</p>
                        <p className="text-xs text-slate-500">
                          {visit.visitNumber} · {loc?.name}
                        </p>
                        <p className="text-xs text-slate-500">{visit.chiefComplaint}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusMeta?.color}>
                      {statusMeta?.label}
                    </Badge>
                    {visit.status === "In Queue" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(visit.id, "In Consultation")}>
                        Mulai Konsultasi
                      </Button>
                    )}
                    {visit.status === "In Consultation" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(visit.id, "Awaiting Pharmacy")}>
                        Selesai Konsultasi
                      </Button>
                    )}
                    {visit.status === "Awaiting Pharmacy" && (
                      <Button size="sm" onClick={() => handleStatusChange(visit.id, "Completed")}>
                        <CheckCircle className="size-3.5" />
                        Selesai
                      </Button>
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
