"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { syncAuditLogs, useSyncedModules } from "@/lib/remote-sync";
import { iamService } from "@/lib/services/iam.service";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { Search, History, ShieldCheck } from "lucide-react";
import { VirtualList } from "@/shared/components/virtual-list";
import { useDebounce } from "@/shared/utils/use-debounce";

export default function AuditLogsPage() {
  const auditLogs = useStore((s) => s.auditLogs);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [actionFilter, setActionFilter] = useState("");
  const [chainResult, setChainResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Modul 7 — audit trail dari backend (GET /iam/audit-logs)
  const { loading, error, refetch } = useSyncedModules(() => syncAuditLogs(1, 100));

  const handleVerifyChain = async () => {
    setVerifying(true);
    setChainResult(null);
    try {
      const res = await iamService.verifyChain();
      setChainResult(
        res.isValid
          ? "Rantai hash SHA-256 VALID — seluruh event audit tidak dimanipulasi."
          : `Rantai hash RUSAK pada index ${res.brokenAtIndex ?? "-"} (event ${res.brokenEntryId ?? "-"}).`
      );
    } catch (e) {
      setChainResult(e instanceof Error ? e.message : "Verifikasi gagal.");
    } finally {
      setVerifying(false);
    }
  };

  const actions = [...new Set(auditLogs.map((l) => l.action))];

  const filtered = auditLogs.filter((l) => {
    const q = debouncedSearch.toLowerCase();
    const matchSearch =
      !q ||
      l.action.toLowerCase().includes(q) ||
      l.userName.toLowerCase().includes(q) ||
      l.objectType.toLowerCase().includes(q);
    const matchAction = !actionFilter || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Immutable audit trail — semua aktivitas tercatat</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              label="Cari action, user, object..."
              placeholder="Cari action, user, object..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label="Action"
            placeholder="Action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            options={actions.map((a) => ({ value: a, label: a }))}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{filtered.length} log entries</p>
        <Button size="sm" variant="outline" onClick={handleVerifyChain} loading={verifying} aria-label="Verifikasi rantai hash SHA-256">
          Verifikasi Rantai Hash
        </Button>
      </div>

      {chainResult && (
        <div className="rounded-xl bg-muted p-3 text-sm text-text-secondary">{chainResult}</div>
      )}

      {error && <ErrorState title="Gagal memuat audit log" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-primary-600" />
            Riwayat Audit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <VirtualList
              items={filtered}
              itemHeight={104}
              renderItem={(log, _index, style) => (
                <div
                  key={log.id}
                  style={style}
                  className="flex items-center justify-between rounded-xl border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.userName} · {log.objectType} · {log.objectId}
                      </p>
                      {log.before && (
                        <p className="text-xs text-muted-foreground">
                          {log.before} → {log.after}
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-xs text-muted-foreground">Alasan: {log.reason}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.at)}</span>
                </div>
              )}
              style={{ maxHeight: "55vh", minHeight: 300 }}
              aria-label="Daftar log audit"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
