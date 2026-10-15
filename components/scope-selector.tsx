"use client";

import { useEffect, useState } from "react";
import { useCurrentUser, useStore } from "@/lib/store";
import { masterDataService } from "@/lib/services/master-data.service";
import { iamService } from "@/lib/services/iam.service";

/**
 * Opsi site untuk selector scope.
 *
 * `code` opsional — hanya dipakai untuk tampilan "Nama (Kode)".
 */
interface SiteOption {
  id: string;
  name: string;
  code?: string;
}

/**
 * Daftar site yang bisa dipilih user.
 *
 * Sumber utama `GET /master-data/sites` (Domain 12). Bila route itu belum
 * tersedia di backend (mis. modul master-data belum terpasang) request-nya
 * 404, jadi fallback ke `GET /iam/users` → `user_roles[].site`: site yang
 * melekat pada role user sendiri — tetap data backend, bukan seed lokal.
 * Kedua sumber gagal → `null` (caller menampilkan keadaan kosong).
 */
async function loadSiteOptions(): Promise<SiteOption[] | null> {
  try {
    const sites = await masterDataService.listSites({ active: true });
    return sites.map((s) => ({ id: s.id, name: s.name, code: s.code }));
  } catch {
    /* modul master-data tidak terpasang di backend — lanjut fallback */
  }

  try {
    // Backend membatasi `limit` ≤ 100 (validation DTO) — tarik beberapa halaman
    // sampai habis, dengan batas aman, agar site milik role yang muncul di
    // halaman belakang tetap terbaca.
    const byId = new Map<string, SiteOption>();
    for (let page = 1; page <= 5; page++) {
      const rows = await iamService.listUsers(page, 100);
      const data = rows.data ?? [];
      for (const row of data) {
        for (const userRole of row.user_roles ?? []) {
          const site = userRole.site;
          if (!site?.id || !site.name || byId.has(site.id)) continue;
          byId.set(site.id, { id: site.id, name: site.name, code: site.code });
        }
      }
      // Halaman terakhir = jumlah baris < limit (tidak ada halaman berikut).
      if (data.length < 100) break;
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

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
  const [sites, setSites] = useState<SiteOption[]>([]);
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
      loadSiteOptions()
        .then((rows) => setSites(rows ?? []))
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
