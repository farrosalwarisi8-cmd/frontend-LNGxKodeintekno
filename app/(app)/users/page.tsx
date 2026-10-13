"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { syncUsers, useSyncedModules } from "@/lib/remote-sync";
import { iamService } from "@/lib/services/iam.service";
import { backendRoleCode } from "@/lib/services/auth.service";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { ROLES } from "@/lib/constants";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { Search, Plus, KeyRound } from "lucide-react";

export default function UsersPage() {
  const users = useStore((s) => s.users);

  // Modul 7 — daftar akun dari backend (GET /iam/users)
  const { loading, error, refetch } = useSyncedModules(() => syncUsers(1, 100));
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "", title: "", mfaEnabled: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  /**
   * Simpan user BARU ke backend (POST /iam/users).
   * Tidak ada mock success: bila backend menolak, error ditampilkan apa adanya.
   */
  const handleCreate = async () => {
    setSaveError(null);
    const roleCode = newUser.role ? backendRoleCode(newUser.role) : null;
    if (!newUser.username || !newUser.password || !roleCode) {
      setSaveError("Username, password, dan role wajib diisi (role admin-klinik/pekerja belum memiliki padanan role backend).");
      return;
    }
    setSaving(true);
    try {
      await iamService.createUser({
        username: newUser.username,
        email: `${newUser.username}@layargas.co.id`,
        password: newUser.password,
        roleCode,
      });
      setShowModal(false);
      setNewUser({ username: "", password: "", name: "", role: "", title: "", mfaEnabled: false });
      await syncUsers(1, 100);
      refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal menyimpan user ke backend.");
    } finally {
      setSaving(false);
    }
  };

  /** Aktif/nonaktifkan akun (PATCH /iam/users/:id) — perubahan nyata di backend. */
  const handleToggleActive = async (id: string, active: boolean) => {
    setTogglingId(id);
    setSaveError(null);
    try {
      await iamService.updateUser(id, { active });
      await syncUsers(1, 100);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal mengubah status user.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manajemen User</h1>
          <p className="text-sm text-slate-500">Kelola akun user dan role</p>
        </div>
        <Can action="users.manage">
          <Button onClick={() => { setSaveError(null); setShowModal(true); }}>
            <Plus className="size-4" />
            Tambah User
          </Button>
        </Can>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={Object.entries(ROLES).map(([value, { label }]) => ({ value, label }))}
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} user</p>

      {saveError && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{saveError}</div>
      )}

      {error && <ErrorState title="Gagal memuat daftar user" message={error} onRetry={refetch} />}

      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((user) => {
          const roleMeta = ROLES[user.role];
          return (
            <Card key={user.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} />
                  <div>
                    <p className="font-medium text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">@{user.username} · {user.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className={roleMeta?.color}>
                        {roleMeta?.label}
                      </Badge>
                      {user.mfaEnabled && (
                        <Badge variant="success">
                          <KeyRound className="size-3" />
                          MFA
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Can action="users.manage">
                    <Button
                      variant="outline"
                      size="sm"
                      loading={togglingId === user.id}
                      disabled={togglingId === user.id}
                      onClick={() => handleToggleActive(user.id, false)}
                    >
                      Nonaktifkan
                    </Button>
                  </Can>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tambah User Baru"
        size="md"
      >
        <div className="space-y-4">
          {saveError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{saveError}</div>
          )}
          <Input label="Username" value={newUser.username} onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))} />
          <Input label="Email" value={newUser.username ? `${newUser.username}@layargas.co.id` : ""} onChange={() => {}} disabled />
          <Input label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
          <Select
            label="Role"
            value={newUser.role}
            onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
            placeholder="Pilih role"
            options={Object.entries(ROLES)
              .filter(([key]) => backendRoleCode(key) !== null)
              .map(([value, { label }]) => ({ value, label }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Can action="users.manage">
              <Button onClick={handleCreate} loading={saving} disabled={saving}>Simpan</Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
