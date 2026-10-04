"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { Search, Plus, ShieldCheck, KeyRound, Users } from "lucide-react";

export default function UsersPage() {
  const users = useStore((s) => s.users);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", name: "", role: "", title: "", mfaEnabled: false });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Manajemen User</h1>
          <p className="text-sm text-slate-500">Kelola akun user dan role</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="size-4" />
          Tambah User
        </Button>
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
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button variant="ghost" size="sm">Reset Password</Button>
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
          <Input label="Nama Lengkap" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} />
          <Input label="Username" value={newUser.username} onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))} />
          <Input label="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
          <Input label="Jabatan" value={newUser.title} onChange={(e) => setNewUser((u) => ({ ...u, title: e.target.value }))} />
          <Select
            label="Role"
            value={newUser.role}
            onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
            placeholder="Pilih role"
            options={Object.entries(ROLES).map(([value, { label }]) => ({ value, label }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={newUser.mfaEnabled} onChange={(e) => setNewUser((u) => ({ ...u, mfaEnabled: e.target.checked }))} className="size-4 rounded border-slate-300" />
            Wajibkan MFA
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
            <Button onClick={() => setShowModal(false)}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
