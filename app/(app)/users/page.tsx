"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { syncUsers, useSyncedModules } from "@/lib/remote-sync";
import { iamService, IamOperationUnsupportedError } from "@/lib/services/iam.service";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { ROLES } from "@/lib/constants";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Search, KeyRound, LockOpen } from "lucide-react";

export default function UsersPage() {
  const users = useStore((s) => s.users);

  // Modul 7 — daftar akun dari backend (GET /iam/users)
  const { loading, error, refetch } = useSyncedModules(() => syncUsers(1, 100));
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  /**
   * Buka kunci akun (POST /iam/users/:id/unlock).
   *
   * Ini satu-satunya operasi tulis yang diekspos backend untuk
   * `iam/users` (lihat API_ENDPOINTS.md §1.5 dan users.controller.ts):
   * akun terkunci setelah beberapa kali login gagal dapat dibuka
   * di sini. Operasi lain (buat/ubah/nonaktifkan akun) TIDAK
   * tersedia di backend — oleh karena itu tidak ada tombolnya,
   * bukan sekadar error 404.
   */
  const handleUnlock = async (userId: string, username: string) => {
    setUnlockingId(userId);
    setActionError(null);
    setActionInfo(null);
    try {
      const res = await iamService.unlockUser(userId);
      setActionInfo(
        `Akun @${res.username ?? username} berhasil dibuka kuncinya.`
      );
    } catch (e) {
      if (e instanceof IamOperationUnsupportedError) {
        setActionError(e.message);
      } else {
        setActionError(
          e instanceof Error ? e.message : "Gagal membuka kunci akun."
        );
      }
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">
            Daftar akun, role, dan scope dari backend (GET /iam/users)
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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

      <p className="text-sm text-muted-foreground">{filtered.length} user</p>

      {actionError && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{actionError}</div>
      )}
      {actionInfo && (
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700">
          {actionInfo}
        </div>
      )}

      <div className="rounded-xl border border-info-200 bg-info-50 p-3 text-sm text-info-700">
        <p className="font-medium">Catatan integrasi backend (Modul 7 — IAM)</p>
        <p className="text-xs">
          Backend saat ini hanya mengekspos pembacaan akun (GET /iam/users,
          GET /iam/users/:id) dan pembukaan kunci (POST /iam/users/:id/unlock).
          Pembuatan, perubahan, dan penonaktifan akun belum tersedia di API —
          kelola provisioning akun di direktori/backend, lalu sinkronkan di
          halaman ini.
        </p>
      </div>

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
          const isInactive = user.active === false;
          return (
            <Card key={user.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} />
                  <div>
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">@{user.username} · {user.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={roleMeta?.color}>
                        {roleMeta?.label}
                      </Badge>
                      <Badge variant={isInactive ? "default" : "success"}>
                        {isInactive ? "Nonaktif" : "Aktif"}
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
                      loading={unlockingId === user.id}
                      disabled={unlockingId === user.id}
                      onClick={() => handleUnlock(user.id, user.username)}
                    >
                      <LockOpen className="size-3.5" />
                      Buka Kunci
                    </Button>
                  </Can>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
