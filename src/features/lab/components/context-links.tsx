"use client";

/**
 * Konteks tertaut order → kunjungan & siklus MCU — Fase A2 (Tugas 6).
 *
 * Penautan data terjadi DI SERVER (field `encounter_id` / `mcu_cycle_id`
 * sudah dikembalikan API); frontend hanya menampilkan dan menavigasi —
 * tidak pernah mencocokkan sendiri.
 *
 * ATURAN RBAC: tautan hanya dirender bila role memiliki permission route
 * tujuannya. Role tanpa `view-mcu` (mis. analis lab) melihat IDENTITAS
 * MINIMUM (id) tanpa tautan — tidak ada jalan masuk ke halaman MCU.
 */

import Link from "next/link";
import { ClipboardList, Activity } from "lucide-react";
import { can } from "@/lib/rbac";
import type { Role } from "@/lib/types";

export interface ContextLinksProps {
  role: Role | null;
  encounterId?: string | null;
  mcuCycleId?: string | null;
}

export function ContextLinks({ role, encounterId, mcuCycleId }: ContextLinksProps) {
  const canVisits = role ? can(role, "view-visits") : false;
  const canMcu = role ? can(role, "view-mcu") : false;

  if (!encounterId && !mcuCycleId) {
    return (
      <p className="text-xs text-muted-foreground">
        Tidak ada tautan kunjungan/MCU pada order ini (sesuai data API).
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {encounterId &&
        (canVisits ? (
          <li>
            <Link
              href="/visits"
              className="inline-flex items-center gap-1.5 font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              <ClipboardList className="size-4" aria-hidden="true" />
              Kunjungan {encounterId}
            </Link>
          </li>
        ) : (
          <li className="inline-flex items-center gap-1.5 text-text-secondary">
            <ClipboardList className="size-4" aria-hidden="true" />
            Kunjungan {encounterId}
            <span className="sr-only">(akses halaman kunjungan tidak tersedia)</span>
          </li>
        ))}
      {mcuCycleId &&
        (canMcu ? (
          <li>
            <Link
              href="/mcu"
              className="inline-flex items-center gap-1.5 font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              <Activity className="size-4" aria-hidden="true" />
              Siklus MCU {mcuCycleId}
            </Link>
          </li>
        ) : (
          <li className="inline-flex items-center gap-1.5 text-text-secondary">
            <Activity className="size-4" aria-hidden="true" />
            Siklus MCU {mcuCycleId}
            <span className="text-xs text-muted-foreground">(akses modul MCU tidak tersedia)</span>
          </li>
        ))}
    </ul>
  );
}
