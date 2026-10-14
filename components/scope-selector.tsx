"use client";

import { useEffect, useState } from "react";
import { useCurrentUser, useStore } from "@/lib/store";
import { masterDataService, type BackendSite } from "@/lib/services/master-data.service";

/**
 * Fase 4 — pemilih scope site untuk user multi-site (GLOBAL).
 *
 * Perilaku:
 *  - Nilai aktif disimpan di store (`activeSiteId`) supaya tetap konsisten
 *    antar halaman dan di-reset saat logout.
 *  - Saat scope berubah, store MEMBUANG data tersinkron milik scope lama dan
 *    menaikkan `scopeVersion` sehingga halaman yang terbuka memuat ulang data
 *    (kriteria: data scope sebelumnya tidak boleh tetap tampil).
 *  - Pilihan "Semua site" mengembalikan tampilan ke cakupan bawaan backend
 *    (backend tetap membatasi per token — selector ini hanya gangguan tampilan).
 */
export function ScopeSelector({ className }: { className?: string }) {
  const currentUser = useCurrentUser();
  const activeSiteId = useStore((s) => s.activeSiteId);
  const activeSiteName = useStore((s) => s.activeSiteName);
  const setActiveSite = useStore((s) => s.setActiveSite);
  const [sites, setSites] = useState<BackendSite[]>([]);
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
        .then(setSites)
        .catch(() => setSites([]))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [canSwitchScope]);

  if (!canSwitchScope) return null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="text-xs text-slate-500">Scope:</span>
      <select
        aria-label="Pilih scope site"
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
        value={activeSiteId ?? ""}
        onChange={(e) => {
          const newSiteId = e.target.value || null;
          const site = sites.find((s) => s.id === newSiteId);
          // null = "Semua site" (tampilan kembali ke cakupan bawaan token).
          setActiveSite(newSiteId, site?.name ?? null);
        }}
        disabled={loading}
      >
        <option value="">Semua site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name} ({site.code})
          </option>
        ))}
      </select>
      {activeSiteName && (
        <span className="hidden text-xs text-slate-400 xl:inline">
          Menampilkan: {activeSiteName}
        </span>
      )}
    </div>
  );
}
