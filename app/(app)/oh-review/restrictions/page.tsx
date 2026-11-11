"use client";

import { isFeatureOhReviewEnabled } from "@/lib/env";
import { FeatureDisabledNotice } from "@/features/oh-review/components/feature-disabled-notice";
import { RestrictionWorkspace } from "@/features/oh-review/components/restriction-workspace";

/**
 * A3 — Route `/oh-review/restrictions` (management restriksi kerja).
 *
 * Di balik feature flag `NEXT_PUBLIC_FEATURE_OH_REVIEW` (default mati).
 * Route dijaga RouteGuard dengan permission `manage-restriction` (Dokter OH).
 */
export default function OhReviewRestrictionsPage() {
  if (!isFeatureOhReviewEnabled()) {
    return <FeatureDisabledNotice feature="Review MCU" />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Restriksi Kerja</h1>
        <p className="text-sm text-slate-500">
          Restriksi kerja aktif dan riwayatnya. Hanya Dokter OH yang dapat menambah, mengubah, atau
          mengakhiri restriksi.
        </p>
      </div>
      <RestrictionWorkspace />
    </div>
  );
}
