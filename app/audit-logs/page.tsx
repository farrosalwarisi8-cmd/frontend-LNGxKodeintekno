"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { formatDateTime } from "@/lib/format";
import { Search, History, ShieldCheck } from "lucide-react";

export default function AuditLogsPage() {
  const auditLogs = useStore((s) => s.auditLogs);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const actions = [...new Set(auditLogs.map((l) => l.action))];

  const filtered = auditLogs.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.action.toLowerCase().includes(q) || l.userName.toLowerCase().includes(q) || l.objectType.toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
        <p className="text-sm text-slate-500">Immutable audit trail — semua aktivitas tercatat</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari action, user, object..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={actions.map((a) => ({ value: a, label: a }))}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} log entries</p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary-600" />
            Riwayat Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-slate-100">
                    <ShieldCheck className="size-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{log.action}</p>
                    <p className="text-xs text-slate-500">
                      {log.userName} · {log.objectType} · {log.objectId}
                    </p>
                    {log.before && (
                      <p className="text-xs text-slate-400">
                        {log.before} → {log.after}
                      </p>
                    )}
                    {log.reason && (
                      <p className="text-xs text-slate-400">Alasan: {log.reason}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-400">{formatDateTime(log.at)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
