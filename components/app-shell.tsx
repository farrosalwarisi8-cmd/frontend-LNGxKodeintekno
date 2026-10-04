"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ScopeSelector } from "@/components/scope-selector";
import { OfflineIndicator } from "@/components/offline-indicator";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasHydrated = useStore((s) => s._hasHydrated);
  const user = useCurrentUser();
  const isOnline = useStore((s) => s.isOnline);
  const setOnline = useStore((s) => s.setOnline);

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace("/login");
    }
  }, [hasHydrated, user, router]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen w-full bg-zinc-50">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <div className="flex items-center justify-between border-b bg-white px-4 py-1.5">
          <ScopeSelector />
          <OfflineIndicator isOnline={isOnline} />
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
