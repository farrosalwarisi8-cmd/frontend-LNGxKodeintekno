"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasHydrated = useStore((s) => s._hasHydrated);
  const user = useCurrentUser();

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace("/login");
    }
  }, [hasHydrated, user, router]);

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
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
