"use client";

import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  Clock,
  Database,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  History,
  LayoutDashboard,
  Lock,
  Package,
  PenLine,
  Pill,
  Settings,
  ShieldCheck,
  Stethoscope,
  Undo2,
  User,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Satu peta nama ikon → komponen lucide.
 *
 * Dipakai oleh sidebar/bottom navigation (`components/emr-shell.tsx`) dan
 * tindakan cepat per peran (`src/features/dashboard/role-tasks.ts` menyimpan
 * nama ikon sebagai string agar tetap bebas React). Satu sumber supaya nama
 * ikon tidak pernah berbeda antara menu dan dashboard.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  activity: Activity,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  pill: Pill,
  "badge-check": BadgeCheck,
  "bar-chart": BarChart3,
  "shield-check": ShieldCheck,
  database: Database,
  history: History,
  "heart-pulse": HeartPulse,
  stethoscope: Stethoscope,
  "user-plus": UserPlus,
  "list-ordered": ClipboardList,
  user: User,
  flask: FlaskConical,
  "alert-triangle": AlertTriangle,
  settings: Settings,
  globe: Globe,
  "pen-line": PenLine,
  "undo-2": Undo2,
  package: Package,
  clock: Clock,
  "calendar-check": CalendarCheck,
  bell: Bell,
  "user-round": UserRound,
  lock: Lock,
};

/** Fallback netral supaya ikon yang belum terdaftar tidak pernah `undefined`. */
export function iconFor(name: string | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || LayoutDashboard;
}
