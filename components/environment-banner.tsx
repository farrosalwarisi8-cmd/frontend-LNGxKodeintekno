"use client";

import { useState } from "react";
import { AlertTriangle, FlaskConical, Info, X } from "lucide-react";
import { API_ENV, environmentLabel } from "@/lib/env";
import { useDemoMode } from "@/lib/demo-role";
import { cn } from "@/lib/utils";

/**
 * Banner lingkungan (non-production) untuk shell internal.
 *
 * Menggantikan banner lama "Demo mode — data dan permission disimulasikan di
 * frontend" yang menyesatkan: aplikasi ini terhubung ke backend nyata, sehingga
 * yang perlu ditandai hanyalah:
 *  - environment aktif (`Local Development` / `Staging`) — HANYA di non-production,
 *  - kegagalan konfigurasi API (bila `NEXT_PUBLIC_API_URL` tidak valid),
 *  - mode demo role (bila diaktifkan eksplisit) sebagai chip kecil, bukan klaim
 *    "tanpa backend".
 *
 * Di production yang dikonfigurasi benar, banner tidak merender apa pun.
 */
export function EnvironmentBanner() {
  const { enabled: demoEnabled } = useDemoMode();
  const [dismissed, setDismissed] = useState(false);

  const configError = API_ENV.baseUrl === null ? API_ENV.error : null;
  const showEnvironment = API_ENV.environment !== "production";

  if (dismissed || (!configError && !showEnvironment && !demoEnabled)) {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "relative z-50 border-b px-4 py-2",
        configError
          ? "border-danger-100 bg-danger-50"
          : "border-info-100 bg-info-50"
      )}
    >
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {configError ? (
            <>
              <AlertTriangle className="size-3.5 shrink-0 text-danger-600" aria-hidden="true" />
              <span className="font-medium text-danger-700">Konfigurasi API bermasalah</span>
              <span className="text-danger-700">{configError}</span>
            </>
          ) : (
            showEnvironment && (
              <>
                <Info className="size-3.5 shrink-0 text-info-600" aria-hidden="true" />
                <span className="font-medium text-info-700">
                  Environment: {environmentLabel()}
                </span>
                <span className="hidden text-info-700 sm:inline">
                  — data non-produksi dapat berubah sewaktu-waktu.
                </span>
              </>
            )
          )}
          {demoEnabled && (
            <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-warning-100 px-1.5 py-0.5 font-medium text-warning-700">
              <FlaskConical className="size-3" aria-hidden="true" />
              Mode demo role aktif
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5"
          aria-label="Tutup banner"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
