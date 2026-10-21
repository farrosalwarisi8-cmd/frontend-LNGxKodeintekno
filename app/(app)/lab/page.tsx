"use client";

/**
 * Route /lab — Fase A2 (Laboratorium & Radiologi).
 *
 * Feature flag `NEXT_PUBLIC_FEATURE_LAB` (default MATI):
 *  - mati  → halaman legacy Tahap 4 persis seperti perilaku main saat ini;
 *  - aktif → workspace A2 (daftar order + alur terima sampel/input/verifikasi).
 *
 * Route tetap dilindungi RouteGuard (`input-lab-result`) di kedua kondisi.
 */

import Link from "next/link";
import { FileUp } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { isLabRadiologyEnabled } from "@/lib/feature-flags";
import { LegacyLabPage } from "@/features/lab/legacy/legacy-lab-page";
import { useLabWorkspace } from "@/features/lab/api";
import { LabOrdersPanel } from "@/features/lab/components/lab-orders-panel";
import { Can } from "@/components/can";

function LabWorkspace() {
  const state = useLabWorkspace();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Laboratorium</h1>
          <p className="text-sm text-slate-500">
            Daftar order dan hasil pemeriksaan penunjang laboratorium
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Can action="lab.import">
            <Link href="/lab/import">
              <Button type="button" variant="outline">
                <FileUp className="size-4" aria-hidden="true" /> Impor hasil (CSV)
              </Button>
            </Link>
          </Can>
        </div>
      </div>

      <LabOrdersPanel state={state} />
    </div>
  );
}

export default function LabPage() {
  if (!isLabRadiologyEnabled()) {
    return <LegacyLabPage />;
  }
  return <LabWorkspace />;
}
