"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { HEALTH_STATUS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { Search, HeartPulse, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function HealthStatusPage() {
  const workHealthStatus = useStore((s) => s.workHealthStatus);
  const employees = useStore((s) => s.employees);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = workHealthStatus.filter((w) => {
    const emp = employees.find((e) => e.id === w.employeeId);
    const q = search.toLowerCase();
    const matchSearch = !q || emp?.fullName.toLowerCase().includes(q) || emp?.employeeId.toLowerCase().includes(q);
    const matchStatus = !statusFilter || w.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Status Kesehatan Kerja</h1>
        <p className="text-sm text-slate-500">Pantau status kesehatan kerja pekerja</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama pekerja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(HEALTH_STATUS).map(([value, { label }]) => ({ value, label }))}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} status kesehatan</p>

      <div className="space-y-3">
        {filtered.map((whs) => {
          const emp = employees.find((e) => e.id === whs.employeeId);
          const statusMeta = HEALTH_STATUS[whs.status];
          const isExpiringSoon = new Date(whs.validUntil).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000;
          return (
            <Card key={whs.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp?.fullName ?? "?"} />
                  <div>
                    <p className="font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">{emp?.employeeId} · {emp?.jobTitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={statusMeta?.color}>
                        {statusMeta?.label}
                      </Badge>
                      {isExpiringSoon && (
                        <Badge variant="warning">
                          <Clock className="size-3" />
                          Segera Berakhir
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Berlaku: {formatDate(whs.validFrom)} — {formatDate(whs.validUntil)}</p>
                  {whs.reviewDate && <p>Review: {formatDate(whs.reviewDate)}</p>}
                </div>
              </div>
              {whs.restriction && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Restriction: {whs.restriction}</span>
                </div>
              )}
              {whs.recommendation && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-info-50 p-3 text-sm text-info-700">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>Rekomendasi: {whs.recommendation}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
