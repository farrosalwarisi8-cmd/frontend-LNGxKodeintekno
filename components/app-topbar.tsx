"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Search, WifiOff, Globe } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES, LANGUAGES } from "@/lib/constants";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { initials } from "@/lib/format";

export function AppTopbar() {
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const notifications = useStore((s) => s.notifications);
  const markAllRead = useStore((s) => s.markAllNotificationsRead);
  const markRead = useStore((s) => s.markNotificationRead);
  const isOnline = useStore((s) => s.isOnline);
  const [searchOpen, setSearchOpen] = useState(false);

  if (!user) return null;
  const nav = NAV[user.role] ?? [];
  const current = nav.find((n) => pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href)));
  const unread = notifications.filter((n) => n.userId === user.id && !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white px-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold">{current?.title ?? "Kodein Klinik"}</h2>
          <p className="text-xs text-muted-foreground">{ROLES[user.role].label}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="gap-2 text-muted-foreground">
                <Search className="size-3.5" />
                <span className="hidden sm:inline">Cari...</span>
                <kbd className="hidden rounded bg-muted px-1 text-[10px] sm:inline">⌘K</kbd>
              </Button>
            }
          />
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Cari pasien, MCU, kunjungan..." />
              <CommandList>
                <CommandEmpty>Tidak ada hasil.</CommandEmpty>
                <CommandGroup heading="Menu">
                  {nav.map((item) => (
                    <CommandItem
                      key={item.href}
                      onSelect={() => {
                        router.push(item.href);
                        setSearchOpen(false);
                      }}
                    >
                      {item.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!isOnline && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
            <WifiOff className="size-3" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}

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
                  <DropdownMenuItem
                    key={n.id}
                    className="flex-col items-start"
                    onClick={() => {
                      markRead(n.id);
                      if (n.link) router.push(n.link);
                    }}
                  >
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
            <DropdownMenuItem onClick={() => router.push("/my/profile")}>
              <Globe className="size-4" /> Bahasa: {LANGUAGES.find((l) => l.code === user.preferredLanguage)?.label ?? "Indonesia"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { logout(); router.replace("/login"); }}>
              <LogOut className="size-4" /> Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
