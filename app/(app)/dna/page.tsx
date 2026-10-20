"use client";

import { isFeatureDnaEnabled } from "@/lib/env";
import { FeatureDisabledNotice } from "@/features/oh-review/components/feature-disabled-notice";
import { DnaWorkspace } from "@/features/dna/components/dna-workspace";

/**
 * A3 — Route `/dna` (modul Drug & Alcohol untuk Dokter OH).
 *
 * Di balik feature flag `NEXT_PUBLIC_FEATURE_DNA` (default mati).
 * Route dijaga RouteGuard dengan permission `view-dna` — akses terbatas.
 */
export default function DnaPage() {
  if (!isFeatureDnaEnabled()) {
    return <FeatureDisabledNotice feature="D&A" />;
  }
  return <DnaWorkspace />;
}
