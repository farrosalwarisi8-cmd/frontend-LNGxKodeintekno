"use client";

import type { ConsentEvent } from "../api/people.types";
import { formatDateTime } from "@/shared/utils/date";
import { CircleCheck, CircleX, Clock3, FileCheck2, RefreshCw, Send, ShieldCheck, AlertTriangle } from "lucide-react";

const EVENT_CONFIG: Record<string, { icon: typeof Clock3; color: string }> = {
  CREATED: { icon: FileCheck2, color: "bg-info-100 text-info-600" },
  SENT: { icon: Send, color: "bg-primary-100 text-primary-600" },
  OPENED: { icon: ShieldCheck, color: "bg-purple-100 text-purple-600" },
  APPROVED: { icon: CircleCheck, color: "bg-success-100 text-success-600" },
  REJECTED: { icon: CircleX, color: "bg-danger-100 text-danger-600" },
  RESENT: { icon: RefreshCw, color: "bg-warning-100 text-warning-600" },
  EXPIRED: { icon: Clock3, color: "bg-slate-100 text-slate-600" },
  DELIVERY_FAILED: { icon: AlertTriangle, color: "bg-danger-100 text-danger-600" },
};

export function ConsentTimeline({ events }: { events: ConsentEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-sm text-slate-500">
        Belum ada event consent.
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {events.map((event, index) => {
        const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.CREATED;
        const Icon = config.icon;
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <div className="absolute left-5 top-10 h-full w-px bg-slate-200" />
            )}
            <div className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ${config.color}`}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{event.label}</p>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatDateTime(event.occurredAt)}
                </span>
              </div>
              <p className="text-xs text-slate-500">{event.actorLabel}</p>
              {Object.keys(event.metadata).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span key={key} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
