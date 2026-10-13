"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/store";
import { masterDataService, type BackendSite } from "@/lib/services/master-data.service";

interface ScopeSelectorProps {
  onScopeChange?: (siteId: string | null) => void;
  className?: string;
}

export function ScopeSelector({ onScopeChange, className }: ScopeSelectorProps) {
  const currentUser = useCurrentUser();
  const [sites, setSites] = useState<BackendSite[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canSwitchScope =
    currentUser?.role === "admin" ||
    currentUser?.role === "manajemen" ||
    currentUser?.role === "hse";

  useEffect(() => {
    if (!canSwitchScope) return;
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => {
      masterDataService
        .listSites({ active: true })
        .then((data) => {
          setSites(data);
          if (data.length > 0 && !activeSiteId) {
            setActiveSiteId(data[0].id);
            onScopeChange?.(data[0].id);
          }
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [canSwitchScope, activeSiteId, onScopeChange]);

  if (!canSwitchScope) return null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-slate-500">Scope:</span>
      <select
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
        value={activeSiteId ?? ""}
        onChange={(e) => {
          const newSiteId = e.target.value || null;
          setActiveSiteId(newSiteId);
          onScopeChange?.(newSiteId);
        }}
        disabled={loading || sites.length === 0}
      >
        {sites.length === 0 && <option value="">Tidak ada site aktif</option>}
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name} ({site.code})
          </option>
        ))}
      </select>
    </div>
  );
}
