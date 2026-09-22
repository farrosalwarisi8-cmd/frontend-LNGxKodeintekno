"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { NAV } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";

export function AppTopbar() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const notifications = useStore((s) => s.notifications);
  const markAllRead = useStore((s) => s.markAllNotificationsRead);

  if (!user) return null;
  const nav = NAV[user.role] ?? [];
  const current = nav.find((n) => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)));
  const unread = notifications.filter((n) => n.userId === user.id && !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-4">
      <div>
        <h2 className="text-sm font-semibold">{current?.title ?? "Kodein Klinik"}</h2>
        <p className="text-xs text-muted-foreground">{ROLES[user.role].label}</p>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                    {unread}
                  </span>
                )}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifikasi
                {unread > 0 && (
                  <Button variant="ghost" size="xs" onClick={markAllRead}>
                    Tandai dibaca
                  </Button>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {notifications.filter((n) => n.userId === user.id).length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  Tidak ada notifikasi.
                </p>
              )}
              {notifications
                .filter((n) => n.userId === user.id)
                .map((n) => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start">
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read && <Badge variant="outline" className="bg-blue-100 text-blue-700">Baru</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{n.message}</span>
                  </DropdownMenuItem>
                ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar size="sm">
                  <AvatarFallback>{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.title} — {ROLES[user.role].label}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { logout(); router.replace("/login"); }}>
              <LogOut className="size-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
