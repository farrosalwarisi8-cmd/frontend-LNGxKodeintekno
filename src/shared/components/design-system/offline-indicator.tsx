"use client";

import { WifiOff } from "lucide-react";

export function OfflineIndicator({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-warning-100 px-3 py-1 text-xs font-medium text-warning-600">
      <WifiOff className="size-3.5" />
      <span>Offline</span>
    </div>
  );
}
