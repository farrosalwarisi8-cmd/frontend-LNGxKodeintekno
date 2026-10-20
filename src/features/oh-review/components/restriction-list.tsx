"use client";

import { Badge } from "@/shared/components/design-system/badge";
import type { ReviewRestriction } from "@/features/oh-review/review-cycle";
import { formatDate } from "@/lib/format";
import { ShieldCheck } from "lucide-react";

/**
 * A3 — Daftar pembatasan kerja (tampilan).
 *
 * Hanya Dokter OH yang boleh menambah/ubah/akhiri pembatasan; role lain tidak
 * melihat daftar ini (hanya status ringkas di halaman Status Kesehatan).
 */
export function RestrictionList({
  restrictions,
  emptyMessage = "Tidak ada restriksi kerja pada siklus ini.",
  testIdPrefix = "restriction",
}: {
  restrictions: ReviewRestriction[];
  emptyMessage?: string;
  testIdPrefix?: string;
}) {
  if (restrictions.length === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {restrictions.map((restriction) => (
        <li
          key={restriction.id}
          data-testid={`${testIdPrefix}-${restriction.id}`}
          className="rounded-xl border border-slate-200 p-3"
        >
          <p className="text-sm font-medium text-slate-900">{restriction.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {restriction.effectiveDate ? (
              <span>Mulai {formatDate(restriction.effectiveDate)}</span>
            ) : null}
            {restriction.reviewDate ? <span>Review {formatDate(restriction.reviewDate)}</span> : null}
            {restriction.supervisor ? <span>Supervisor: {restriction.supervisor}</span> : null}
            {restriction.controls ? <span>Kontrol: {restriction.controls}</span> : null}
            {restriction.status ? (
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3" />
                {restriction.status}
              </Badge>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
