"use client";

import { cn } from "@/lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary-600" />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner />
        <p className="text-sm text-slate-500">Memuat...</p>
      </div>
    </div>
  );
}

export function CardLoading() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-1/3 rounded bg-slate-100" />
      <div className="h-4 w-1/2 rounded bg-slate-100" />
      <div className="h-4 w-2/3 rounded bg-slate-100" />
    </div>
  );
}
