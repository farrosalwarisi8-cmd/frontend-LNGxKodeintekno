"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { CalculationRow } from "@/features/oh-review/calculation-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Info } from "lucide-react";

/**
 * A3 — Penanda perburukan (ikon + teks).
 *
 * Penanda hanya tampil bila API mengirim flag perburukan. Tidak ada penilaian
 * perburukan yang dihitung di frontend.
 */
export function WorseningMarker({ worsening }: { worsening: boolean | null }) {
  if (worsening === null) return null;
  if (worsening) {
    return (
      <span
        data-testid="worsening-marker"
        className="inline-flex items-center gap-1 text-xs font-medium text-danger-600"
      >
        <TrendingDown className="size-3.5" />
        Perburukan dibanding tahun lalu
      </span>
    );
  }
  return (
    <span
      data-testid="worsening-marker"
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"
    >
      <TrendingUp className="size-3.5" />
      Tidak ada perburukan
    </span>
  );
}

/**
 * A3 — Panel nilai hasil perhitungan server (BMI, TD, audiometri, spirometri,
 * skor CV, dan lain-lain).
 *
 * Nilai ditampilkan APA ADANYA dari API. Tidak ada ambang, rumus, atau
 * reinterpretasi di frontend.
 */
export function CalculatedValuesPanel({
  rows,
  worseningAvailable,
}: {
  rows: CalculationRow[];
  worseningAvailable: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nilai terhitung (dari server)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          BMI, klasifikasi tekanan darah, audiometri, spirometri, dan skor kardiovaskular
          dihitung di server. Nilai di bawah ditampilkan apa adanya.
        </p>

        {!worseningAvailable && (
          <p
            data-testid="worsening-unavailable"
            className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"
          >
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Penanda perburukan dibanding tahun lalu belum tersedia dari API — backend belum
              mengirim flag perbandingan.
            </span>
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada nilai hasil perhitungan yang dikirim API untuk siklus ini.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li
                key={row.key}
                data-testid="calculation-row"
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-slate-700">{row.label}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    {row.value}
                    {row.unit ? (
                      <span className="ml-1 text-xs font-normal text-slate-500">{row.unit}</span>
                    ) : null}
                  </span>
                  <WorseningMarker worsening={row.worsening} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
