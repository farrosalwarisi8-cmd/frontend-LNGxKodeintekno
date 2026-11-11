"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { fetchSupportingResults, type SupportingResult } from "@/features/oh-review/api";
import { FlaskConical, ShieldCheck } from "lucide-react";

/**
 * A3 — Hasil penunjang terverifikasi (Fase A2), READ-ONLY.
 *
 * A3 hanya MEMBACA hasil yang sudah "Terverifikasi" di layar review.
 * Alur input/verifikasi lab milik A2 dan tidak diubah di sini.
 */
export function SupportingResultsPanel({ cycleId }: { cycleId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SupportingResult[]>([]);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchSupportingResults(cycleId);
      setResults(bundle.results);
      setUnavailableReason(bundle.unavailableReason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat hasil penunjang.");
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      void load().finally(() => {
        if (!alive) return;
      });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load, reloadKey]);

  return (
    <Card data-testid="supporting-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary-600" />
          Hasil penunjang terverifikasi (A2)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          Hanya hasil yang sudah berstatus terverifikasi yang ditampilkan. Modul ini read-only —
          input dan verifikasi hasil tetap milik modul Lab &amp; Radiologi.
        </p>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        )}

        {!loading && error && (
          <ErrorState
            title="Gagal memuat hasil penunjang"
            message={error}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {!loading && !error && unavailableReason && (
          <p
            data-testid="supporting-results-unavailable"
            className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
          >
            {unavailableReason}
          </p>
        )}

        {!loading && !error && !unavailableReason && results.length === 0 && (
          <p className="text-sm text-slate-500">
            Belum ada hasil penunjang terverifikasi yang terkait dengan siklus MCU ini.
          </p>
        )}

        {!loading && !error && results.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {results.map((result) => (
              <li
                key={`${result.resultId}-${result.parameterName}`}
                className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-slate-700">{result.parameterName}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-900">
                    {result.value}
                    {result.unit ? (
                      <span className="ml-1 text-xs font-normal text-slate-500">{result.unit}</span>
                    ) : null}
                  </span>
                  {result.abnormalFlag === true ? (
                    <Badge variant="warning">Di luar rentang</Badge>
                  ) : null}
                  {result.verifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <ShieldCheck className="size-3.5" />
                      Terverifikasi
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
