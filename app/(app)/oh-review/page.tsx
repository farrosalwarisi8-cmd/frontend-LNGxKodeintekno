"use client";

import { isFeatureOhReviewEnabled } from "@/lib/env";
import { FeatureDisabledNotice } from "@/features/oh-review/components/feature-disabled-notice";
import { OhReviewWorkspace } from "@/features/oh-review/components/oh-review-workspace";

/**
 * A3 — Route `/oh-review` (antrean & detail review MCU, Dokter OH).
 *
 * Di balik feature flag `NEXT_PUBLIC_FEATURE_OH_REVIEW` (default mati).
 * Saat flag mati, route menampilkan status fitur belum aktif dan menu tidak
 * tampil — perilaku aplikasi lama tidak berubah.
 */
export default function OhReviewPage() {
  if (!isFeatureOhReviewEnabled()) {
    return <FeatureDisabledNotice feature="Review MCU" />;
  }
  return <OhReviewWorkspace />;
}
