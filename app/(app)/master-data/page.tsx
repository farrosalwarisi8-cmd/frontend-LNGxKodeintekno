"use client";

import { Can } from "@/components/can";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  syncInventory,
  syncMasterData,
  syncPatients,
  useSyncedModules,
} from "@/lib/remote-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Modal } from "@/shared/components/design-system/modal";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { ApiError } from "@/lib/api-client";
import {
  masterDataService,
  findDuplicateCode,
  type BackendDepartment,
  type BackendOrganization,
  type BackendSite,
} from "@/lib/services/master-data.service";
import { Database, Plus, Pill, Stethoscope, Building2, MapPin } from "lucide-react";

type TabId = "diagnoses" | "medicines" | "companies" | "departments" | "locations";
type FormKind = "company" | "department" | "location";

export default function MasterDataPage() {
  const diagnoses = useStore((s) => s.diagnoses);
  const medicines = useStore((s) => s.medicines);

  // Modul 11 — master data klinis dari backend (ICD-10 + inventaris obat)
  useSyncedModules(async () => {
    await syncMasterData();
    await syncInventory();
    await syncPatients(1, 100);
  });

  // Master data organisasi/departemen/site: SUMBER UTAMA adalah API backend.
  const [organizations, setOrganizations] = useState<BackendOrganization[]>([]);
  const [departments, setDepartments] = useState<BackendDepartment[]>([]);
  const [sites, setSites] = useState<BackendSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Fase 6 — kegagalan SEBAGIAN (route backend yang belum terpasang): tidak
  // memblokir tab lain, hanya menampilkan peringatan di atas tabel.
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("diagnoses");
  const [showCreate, setShowCreate] = useState<FormKind | null>(null);
  const [editing, setEditing] = useState<
    | { kind: "company"; row: BackendOrganization }
    | { kind: "department"; row: BackendDepartment }
    | { kind: "location"; row: BackendSite }
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  // Fase 4 — dependency guard: setelah 409 (site/org masih punya data aktif),
  // UI menawarkan konfirmasi "force" alih-alih hanya menyuruh user mengulang.
  const [forceTarget, setForceTarget] = useState<
    { kind: FormKind; id: string; label: string; nextActive: boolean } | null
  >(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    parentId: "",
    siteType: "ONSHORE_PLANT",
    address: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadWarning(null);
    // Ketiga modul dibaca TERPISAH: bila satu route backend belum terpasang
    // (mis. /master-data/sites 404 karena modulnya belum diaktifkan), tab lain
    // tetap menampilkan data backend yang berhasil dimuat, bukan seluruh
    // halaman gagal. Kegagalan dicatat per sumber agar user tahu mana yang
    // belum tersedia.
    const failures: string[] = [];
    const [orgs, depts, siteRows] = await Promise.all([
      masterDataService.listOrganizations().catch((e: unknown) => {
        failures.push(`perusahaan: ${e instanceof Error ? e.message : "gagal dimuat"}`);
        return [] as BackendOrganization[];
      }),
      masterDataService.listDepartments().catch((e: unknown) => {
        failures.push(`departemen: ${e instanceof Error ? e.message : "gagal dimuat"}`);
        return [] as BackendDepartment[];
      }),
      masterDataService.listSites().catch((e: unknown) => {
        failures.push(`lokasi: ${e instanceof Error ? e.message : "gagal dimuat"}`);
        return [] as BackendSite[];
      }),
    ]);
    setOrganizations(orgs);
    setDepartments(depts);
    setSites(siteRows);
    if (failures.length > 0) {
      // Gagal SEMUA sumber -> ErrorState penuh (ada tombol coba ulang).
      // Gagal SEBAGIAN -> peringatan, tab yang berhasil tetap dipakai.
      const loaded = orgs.length + depts.length + siteRows.length;
      if (loaded === 0) {
        setLoadError(`Gagal memuat master data dari backend — ${failures.join("; ")}.`);
      } else {
        setLoadWarning(`Sebagian data belum tersedia di backend — ${failures.join("; ")}.`);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const resetForm = () => {
    setForm({ code: "", name: "", parentId: "", siteType: "ONSHORE_PLANT", address: "" });
    setActionError(null);
  };

  /**
   * Fase 4 — guard kode duplikat di lapisan client.
   *
   * Backend memberlakukan unique constraint (409). Pemeriksaan awal di sini
   * memberi umpan balik instan tanpa request, DAN tidak menggantikan 409
   * dari backend (tetap ditangani sebagai kebenaran terakhir).
   */
  const duplicateCode = (code: string, kind: FormKind, excludeId?: string): string | null => {
    const rows: Array<{ id: string; code: string }> =
      kind === "company"
        ? organizations
        : kind === "department"
          ? departments
          : sites;
    const clash = findDuplicateCode(rows, code, excludeId);
    if (!clash) return null;
    const label = kind === "company" ? "perusahaan" : kind === "department" ? "departemen" : "lokasi";
    return `Kode \"${clash}\" sudah dipakai ${label} lain.`;
  };

  const handleCreate = async () => {
    if (!showCreate) return;
    setActionError(null);
    if (!form.name || (showCreate !== "location" && !form.code)) {
      setActionError("Kode dan nama wajib diisi.");
      return;
    }
    // Fase 4 — tolak kode duplikat sebelum request keluar (guard client).
    const dup = duplicateCode(form.code, showCreate);
    if (dup) {
      setActionError(dup);
      return;
    }
    setSaving(true);
    try {
      if (showCreate === "company") {
        await masterDataService.createOrganization({ code: form.code, name: form.name });
      } else if (showCreate === "department") {
        await masterDataService.createDepartment({
          organizationId: form.parentId || organizations[0]?.id,
          code: form.code,
          name: form.name,
        });
      } else {
        await masterDataService.createSite({
          orgUnitId: form.parentId || departments[0]?.id,
          code: form.code,
          name: form.name,
          siteType: form.siteType,
          address: form.address || undefined,
        });
      }
      setShowCreate(null);
      resetForm();
      await load();
    } catch (e) {
      setActionError(
        e instanceof ApiError && e.status === 409
          ? "Kode sudah dipakai (409 Conflict). Gunakan kode lain."
          : e instanceof Error
            ? e.message
            : "Gagal menyimpan."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setActionError(null);
    setSaving(true);
    try {
      if (editing.kind === "company") {
        await masterDataService.updateOrganization(editing.row.id, { name: form.name });
      } else if (editing.kind === "department") {
        await masterDataService.updateDepartment(editing.row.id, { name: form.name });
      } else {
        await masterDataService.updateSite(editing.row.id, {
          name: form.name,
          siteType: form.siteType,
          address: form.address || undefined,
        });
      }
      setEditing(null);
      resetForm();
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memperbarui.");
    } finally {
      setSaving(false);
    }
  };

  const applyStatus = async (
    kind: FormKind,
    id: string,
    nextActive: boolean,
    force?: boolean
  ) => {
    if (kind === "company") {
      await masterDataService.setOrganizationStatus(id, nextActive ? "ACTIVE" : "INACTIVE", force);
    } else if (kind === "department") {
      await masterDataService.setDepartmentStatus(id, nextActive);
    } else {
      await masterDataService.setSiteStatus(id, nextActive, force);
    }
  };

  const handleToggleStatus = async (
    kind: FormKind,
    id: string,
    nextActive: boolean,
    currentActive: boolean
  ) => {
    if (nextActive === currentActive) return;
    setActionError(null);
    try {
      await applyStatus(kind, id, nextActive);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !nextActive) {
        // Fase 4 — dependency guard: tawarkan konfirmasi force (backend
        // menerima force=true; histori tetap tersimpan, tidak ada data dihapus).
        const row =
          kind === "company"
            ? organizations.find((o) => o.id === id)
            : kind === "department"
              ? departments.find((d) => d.id === id)
              : sites.find((s) => s.id === id);
        setForceTarget({ kind, id, label: row?.name ?? id, nextActive });
        setActionError(e.message);
      } else {
        setActionError(e instanceof Error ? e.message : "Gagal mengubah status.");
      }
    }
  };

  const confirmForce = async () => {
    if (!forceTarget) return;
    const { kind, id, nextActive } = forceTarget;
    setActionError(null);
    try {
      await applyStatus(kind, id, nextActive, true);
      setForceTarget(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Gagal memaksa perubahan status.");
      setForceTarget(null);
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof Database; count: number }[] = [
    { id: "diagnoses", label: "Diagnosis ICD-10", icon: Stethoscope, count: diagnoses.length },
    { id: "medicines", label: "Obat", icon: Pill, count: medicines.length },
    { id: "companies", label: "Perusahaan", icon: Building2, count: organizations.length },
    { id: "departments", label: "Departemen", icon: Building2, count: departments.length },
    { id: "locations", label: "Lokasi", icon: MapPin, count: sites.length },
  ];

  const renderStatus = (active: boolean) => (
    <Badge variant={active ? "success" : "default"}>{active ? "ACTIVE" : "INACTIVE"}</Badge>
  );

  const renderRowActions = (kind: FormKind, id: string, active: boolean) => (
    <Can action="master-data.edit">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setActionError(null);
            const row =
              kind === "company"
                ? organizations.find((o) => o.id === id)
                : kind === "department"
                  ? departments.find((d) => d.id === id)
                  : sites.find((s) => s.id === id);
            if (!row) return;
            setForm({
              code: "code" in row ? row.code : "",
              name: row.name,
              parentId: "",
              siteType: "site_type" in row ? (row.site_type ?? "ONSHORE_PLANT") : "ONSHORE_PLANT",
              address: "address" in row ? (row.address ?? "") : "",
            });
            setEditing({ kind, row } as never);
          }}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleToggleStatus(kind, id, !active, active)}
        >
          {active ? "Nonaktifkan" : "Aktifkan"}
        </Button>
      </div>
    </Can>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Master Data</h1>
        <p className="text-sm text-slate-500">
          Perusahaan, departemen, dan lokasi bersumber dari API backend sesuai permission Anda
        </p>
      </div>

      {actionError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {actionError}
        </div>
      )}

      {/* Fase 6 — peringatan parsial: sumber backend yang belum tersedia tidak
          memblokir tab lain; tabel yang berhasil tetap dirender di bawah. */}
      {!loading && !loadError && loadWarning && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
          {loadWarning}
        </div>
      )}

      {/* Fase 4 — konfirmasi dependency guard (force) */}
      {forceTarget && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-warning-800">
            <p className="font-medium">
              {forceTarget.label} masih memiliki data aktif yang bergantung padanya.
            </p>
            <p className="text-xs">
              Nonaktifkan paksa? Histori tetap tersimpan — tidak ada data yang dihapus.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setForceTarget(null)}>
              Batal
            </Button>
            <Button size="sm" onClick={confirmForce}>
              Nonaktifkan Paksa
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                activeTab === tab.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.id ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "diagnoses" && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnosis ICD-10</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {diagnoses.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.code} — {d.description}</p>
                    <p className="text-xs text-slate-500">{d.category}</p>
                  </div>
                  <Badge variant="info">{d.category || "ICD-10"}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "medicines" && (
        <Card>
          <CardHeader>
            <CardTitle>Obat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {medicines.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.code} · {m.category} · Min: {m.minStock}</p>
                  </div>
                  <Badge variant="success">{m.unit}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && loadError && (
        <ErrorState title="Gagal memuat master data" message={loadError} onRetry={load} />
      )}

      {!loading && !loadError && activeTab === "companies" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Perusahaan</CardTitle>
              <Can action="master-data.edit">
                <Button size="sm" onClick={() => { resetForm(); setShowCreate("company"); }}>
                  <Plus className="size-3.5" />
                  Tambah
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {organizations.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStatus(c.status === "ACTIVE")}
                    {renderRowActions("company", c.id, c.status === "ACTIVE")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && activeTab === "departments" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Departemen</CardTitle>
              <Can action="master-data.edit">
                <Button size="sm" onClick={() => { resetForm(); setShowCreate("department"); }}>
                  <Plus className="size-3.5" />
                  Tambah
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {departments.map((d) => (
                <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {d.code} · {d.organization?.name ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStatus(d.active)}
                    {renderRowActions("department", d.id, d.active)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !loadError && activeTab === "locations" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lokasi Kerja</CardTitle>
              <Can action="master-data.edit">
                <Button size="sm" onClick={() => { resetForm(); setShowCreate("location"); }}>
                  <Plus className="size-3.5" />
                  Tambah
                </Button>
              </Can>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sites.map((l) => (
                <div key={l.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{l.name}</p>
                    <p className="text-xs text-slate-500">
                      {l.code} · {l.org_unit?.organization?.name ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="capitalize">
                      {l.site_type?.replace(/_/g, " ").toLowerCase() ?? "-"}
                    </Badge>
                    {renderStatus(l.active)}
                    {renderRowActions("location", l.id, l.active)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Modal
        open={showCreate !== null || editing !== null}
        onClose={() => {
          setShowCreate(null);
          setEditing(null);
          resetForm();
        }}
        title={
          editing
            ? `Edit ${editing.kind === "company" ? "Perusahaan" : editing.kind === "department" ? "Departemen" : "Lokasi"}`
            : `Tambah ${showCreate === "company" ? "Perusahaan" : showCreate === "department" ? "Departemen" : "Lokasi"}`
        }
        size="lg"
      >
        <div className="space-y-4">
          {(showCreate === "company" || showCreate === "department" || showCreate === "location") && (
            <Input
              label="Kode"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              disabled={Boolean(editing)}
            />
          )}

          {showCreate === "department" && !editing && (
            <Select
              label="Perusahaan"
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              placeholder="Pilih perusahaan"
              options={organizations.map((o) => ({ value: o.id, label: `${o.code} — ${o.name}` }))}
            />
          )}

          {(showCreate === "location" || editing?.kind === "location") && (
            <>
              <Select
                label="Departemen"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                placeholder="Pilih departemen"
                options={departments.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
              />
              <Select
                label="Tipe"
                value={form.siteType}
                onChange={(e) => setForm((f) => ({ ...f, siteType: e.target.value }))}
                options={[
                  { value: "HEAD_OFFICE", label: "Head Office" },
                  { value: "ONSHORE_PLANT", label: "Onshore Plant" },
                  { value: "OFFSHORE_PLATFORM", label: "Offshore Platform" },
                  { value: "REMOTE_CLINIC", label: "Remote Clinic" },
                ]}
              />
              <Input
                label="Alamat"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </>
          )}

          <Input
            label="Nama"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          {actionError && <p className="text-xs text-danger-600">{actionError}</p>}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreate(null);
                setEditing(null);
                resetForm();
              }}
            >
              Batal
            </Button>
            <Can action="master-data.edit">
              <Button onClick={editing ? handleUpdate : handleCreate} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
