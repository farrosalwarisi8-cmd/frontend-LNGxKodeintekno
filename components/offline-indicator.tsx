"use client";

import { WifiOff } from "lucide-react";

export function OfflineIndicator({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
      <WifiOff className="size-3.5" />
      Offline
    </div>
  );
}
