"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials } from "@/lib/format";

export default function UsersPage() {
  const user = useCurrentUser();
  const users = useStore((s) => s.users);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Akun demo dan perannya. Pengelolaan penuh tersedia pada development lanjutan."
      />
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const meta = ROLES[u.role];
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta.color}>
                      {meta.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
