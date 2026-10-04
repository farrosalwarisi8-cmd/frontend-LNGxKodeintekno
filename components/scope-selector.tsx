"use client";

import { Building2, MapPin } from "lucide-react";
import { useStore } from "@/lib/store";

export function ScopeSelector() {
  const companies = useStore((s) => s.companies);
  const locations = useStore((s) => s.locations);
  const orgScope = useStore((s) => s.orgScope);
  const setOrgScope = useStore((s) => s.setOrgScope);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Building2 className="size-3.5" />
      <select
        value={orgScope.companyId || "all"}
        onChange={(e) => setOrgScope({ ...orgScope, companyId: e.target.value === "all" ? "" : e.target.value })}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        <option value="all">Semua Perusahaan</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <MapPin className="size-3.5" />
      <select
        value={orgScope.locationId || "all"}
        onChange={(e) => setOrgScope({ ...orgScope, locationId: e.target.value === "all" ? "" : e.target.value })}
        className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
      >
        <option value="all">Semua Lokasi</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
