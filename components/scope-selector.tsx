"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { masterDataService } from "@/lib/services/master-data.service";
import { iamService } from "@/lib/services/iam.service";
import { useDemoMode } from "@/lib/demo-role";
import { canSwitchSiteScope, dataScopeForRole, DATA_SCOPE_LABELS } from "@/lib/data-scope";

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
      if (data.length < 100) break;
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

/**
 * Pemilih scope site untuk user multi-site (GLOBAL/ORG).
 *
 * Role efektif (termasuk demo role) menentukan apakah kontrol ini tampil:
 * Pekerja (PERSONAL) dan peran SITE tidak memiliki selector. Nilai aktif
 * disimpan di store agar tetap konsisten antar halaman; backend tetap
 * menegakkan cakupan sebenarnya.
 */
export function ScopeSelector({ className }: { className?: string }) {
  const { role } = useDemoMode();
  const activeSiteId = useStore((s) => s.activeSiteId);
  const activeSiteName = useStore((s) => s.activeSiteName);
  const setActiveSite = useStore((s) => s.setActiveSite);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);

  const allowed = canSwitchSiteScope(role);
  const scope = dataScopeForRole(role);

  useEffect(() => {
    if (!allowed) return;
    const timer = setTimeout(() => {
      loadSiteOptions()
        .then((rows) => setSites(rows ?? []))
        .catch(() => setSites([]))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [allowed]);

  if (!allowed || !scope) return null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Globe2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <label htmlFor="scope-site" className="sr-only">
        Pilih scope site ({DATA_SCOPE_LABELS[scope]})
      </label>
      <select
        id="scope-site"
        aria-label={`Scope site — ${DATA_SCOPE_LABELS[scope]}`}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={activeSiteId ?? ""}
        onChange={(e) => {
          const newSiteId = e.target.value || null;
          const site = sites.find((s) => s.id === newSiteId);
          setActiveSite(newSiteId, site?.name ?? null);
        }}
        disabled={loading}
      >
        <option value="">Semua site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
            {site.code ? ` (${site.code})` : ""}
          </option>
        ))}
      </select>
      {activeSiteName && (
        <span className="hidden text-xs text-muted-foreground xl:inline">Menampilkan: {activeSiteName}</span>
      )}
    </div>
  );
}
