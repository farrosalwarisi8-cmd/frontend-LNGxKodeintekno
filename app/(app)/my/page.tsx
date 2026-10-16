"use client";

import Link from "next/link";
import {
  UserRound,
  Activity,
  BadgeCheck,
  Bell,
  ChevronRight,
  HeartPulse,
  type LucideIcon,
} from "lucide-react";
import { useCurrentUser, useStore } from "@/lib/store";
import { syncPatients, syncWorkHealthStatus, useSyncedModules } from "@/lib/remote-sync";
import { findMyEmployee } from "@/lib/services/auth.service";
import { ROLES } from "@/lib/constants";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: "/my/profile", label: "Profil Saya", description: "Data akun & detail pekerja", icon: UserRound },
  { href: "/my/mcu", label: "MCU Saya", description: "Riwayat MCU & status Fitness to Work", icon: Activity },
  { href: "/my/certificates", label: "Sertifikat Saya", description: "Sertifikat kesehatan kerja", icon: BadgeCheck },
  { href: "/my/notifications", label: "Notifikasi Saya", description: "Riwayat notifikasi & status pengiriman", icon: Bell },
];

/**
 * Landing `/my` — hub ruang pribadi pengguna.
 *
 * Tanpa halaman ini, breadcrumb `/my/profile` menautkan ke `/my` yang tidak ada
 * (dead link). Hub ini juga menjadi satu titik masuk ke profil, MCU, sertifikat,
 * dan notifikasi milik akun yang sedang login.
 */
export default function MyPage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const workHealthStatus = useStore((s) => s.workHealthStatus);

  // Halaman pekerja: status Fitness to Work ditampilkan langsung di hub
  // supaya pertanyaan "apakah saya masih fit?" tidak perlu klik tambahan.
  const { loading } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncWorkHealthStatus(1, 100);
  });

  if (!user) return null;

  const roleMeta = ROLES[user.role];
  const myEmployee = findMyEmployee(employees, user);
  const myStatus = myEmployee
    ? workHealthStatus.find((w) => w.employeeId === myEmployee.id)
    : undefined;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Akun Saya</h1>
        <p className="text-sm text-slate-500">Profil, MCU, sertifikat, dan notifikasi Anda</p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">@{user.username}</p>
          </div>
          <Badge variant="outline" className={cn("ml-auto shrink-0", roleMeta.color)}>
            {roleMeta.label}
          </Badge>
        </div>
      </Card>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <HeartPulse className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">Status kesehatan kerja saya</p>
              {myStatus ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      myStatus.status === "Fit to Work"
                        ? "success"
                        : myStatus.status === "Fit with Restriction"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {myStatus.status}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    Berlaku s.d. {formatDate(myStatus.validUntil)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  Belum ada status Fitness to Work untuk akun ini.
                </p>
              )}
              {myStatus?.restriction && (
                <p className="mt-1 text-xs text-warning-600">Restriction: {myStatus.restriction}</p>
              )}
            </div>
            <Link
              href="/my/mcu"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Detail MCU
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/30"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
