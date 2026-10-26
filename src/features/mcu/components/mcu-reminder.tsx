"use client";

import { Bell, Clock, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  reminderState,
  reminderSummary,
  reminderTimeline,
  type ReminderIcon,
  type ReminderTone,
} from "@/lib/mcu-reminder";

/**
 * Badge tahapan reminder MCU (A1 — Tugas 2).
 *
 * Status SELALU ditampilkan sebagai TEKS + IKON (tidak hanya warna), sesuai
 * syarat aksesibilitas repo. `data-testid` dipakai E2E agar selector stabil.
 */

const ICONS: Record<ReminderIcon, typeof Bell> = {
  bell: Bell,
  clock: Clock,
  alert: AlertTriangle,
  check: CheckCircle,
  help: HelpCircle,
};

const TONE_TO_VARIANT: Record<ReminderTone, "default" | "success" | "warning" | "danger" | "info" | "outline"> = {
  info: "info",
  warning: "warning",
  danger: "danger",
  success: "success",
  muted: "outline",
};

export interface McuReminderBadgeProps {
  /** Tanggal berakhir (YYYY-MM-DD atau ISO). */
  validUntil: string | null | undefined;
  /** Tanggal acuan; default waktu sekarang. */
  now?: Date;
  className?: string;
  /** Tampilkan sisa hari pada teks badge. */
  showSummary?: boolean;
}

export function McuReminderBadge({
  validUntil,
  now,
  className,
  showSummary = true,
}: McuReminderBadgeProps) {
  const state = reminderState(validUntil, now);
  const Icon = ICONS[state.icon];
  const text = showSummary ? reminderSummary(state) : state.label;

  return (
    <Badge
      variant={TONE_TO_VARIANT[state.tone]}
      className={className}
      title={state.description}
      data-testid="mcu-reminder-badge"
      data-reminder-stage={state.status}
    >
      <Icon className="size-3" aria-hidden="true" />
      {text}
    </Badge>
  );
}

export interface McuReminderTimelineProps {
  validUntil: string | null | undefined;
  now?: Date;
  className?: string;
}

/**
 * Garis waktu tahapan reminder (H-30 → H-14 → H-7 → Hari-H → Overdue).
 * Tahap yang reached ditandai ikon centang + teks "Tercapai"; tahap saat ini
 * ditandai label "sekarang". Tidak bergantung pada warna saja.
 */
export function McuReminderTimeline({ validUntil, now, className }: McuReminderTimelineProps) {
  const entries = reminderTimeline(validUntil, now);

  return (
    <ol className={cn("flex flex-wrap items-center gap-2", className)} data-testid="mcu-reminder-timeline">
      {entries.map((entry) => {
        const Icon = ICONS[entry.icon];
        return (
          <li key={entry.stage} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                entry.current
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : entry.reached
                    ? "border-border bg-muted text-text-secondary"
                    : "border-dashed border-border bg-card text-muted-foreground"
              )}
              title={entry.description}
              data-testid={`reminder-stage-${entry.stage}`}
              data-reached={entry.reached ? "true" : "false"}
              data-current={entry.current ? "true" : "false"}
            >
              {entry.reached ? (
                <CheckCircle className="size-3" aria-hidden="true" />
              ) : (
                <Icon className="size-3" aria-hidden="true" />
              )}
              {entry.label}
              {entry.current ? " (sekarang)" : entry.reached ? " (tercapai)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
