"use client";

import { Card, CardContent } from "@/shared/components/design-system/card";
import { Info } from "lucide-react";

/**
 * A3 — Status "fitur belum aktif".
 *
 * Ditampilkan saat feature flag terkait MATI (default). Menu untuk route ini
 * juga disembunyikan, sehingga perilaku aplikasi lama tidak berubah.
 */
export function FeatureDisabledNotice({ feature }: { feature: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100">
          <Info className="size-6 text-slate-500" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Fitur {feature} belum aktif</h1>
        <p className="max-w-md text-sm text-slate-500">
          Modul ini berada di balik feature flag lingkungan yang saat ini masih mati
          (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">NEXT_PUBLIC_FEATURE_*</code>).
          Aktifkan flag pada build environment yang sudah siap.
        </p>
      </CardContent>
    </Card>
  );
}
