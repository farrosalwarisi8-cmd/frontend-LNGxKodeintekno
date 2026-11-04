"use client";

/**
 * Pemeriksaan Kedaluwarsa MCU — endpoint backend Domain 4:
 *   POST /api/v1/mcu/cron/check-expirations   (DOCTOR_OH, SYSTEM_ADMIN, HR_ADMIN)
 *
 * Backend menjalankan pemeriksaan berkala H-30/H-14/H-7/overdue. Tombol ini
 * memicu pemeriksaan yang sama secara manual.
 *
 * Catatan kontrak: role yang diizinkan backend (dokter OH, admin sistem, HR)
 * tidak punya satu permission frontend yang persis mencakup ketiganya, sehingga
 * panel memakai permission `escalation.run` (manage-hse) sebagai gerbang UI dan
 * tetap bergantung pada otorisasi backend sebagai kebenaran terakhir — role
 * tanpa izin melihat tombol non-aktif beserta alasannya, bukan aksi yang pasti
 * ditolak 403.
 */

import { Can } from "@/components/can";
import { useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Button } from "@/shared/components/design-system/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { mcuService } from "@/lib/services/mcu.service";
import { permissionsForAction } from "@/lib/actions";

export default function McuExpiryCheckPanel() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const required = permissionsForAction("escalation.run");
  const disabledReason = `Perlu izin: ${required.join(", ")} (dokter OH / admin sistem / HR).`;

  const handleRun = async () => {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      await mcuService.triggerExpiryCheck();
      setMessage("Pemeriksaan kedaluwarsa MCU dijalankan. Reminder mengikuti hasil backend.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menjalankan pemeriksaan kedaluwarsa.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card data-testid="expiry-check-panel">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Pemeriksaan Kedaluwarsa MCU</h2>
          <p className="text-xs text-muted-foreground">
            Menjalankan pemeriksaan manual untuk MCU yang mendekati atau sudah melewati masa
            berlaku (H-30, H-14, H-7, overdue). Backend yang menentukan notifikasi yang terkirim.
          </p>
        </div>
        <Can
          action="escalation.run"
          fallback={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled title={disabledReason}>
                <RefreshCw className="size-4" />
                Jalankan pemeriksaan
              </Button>
              <span className="text-xs text-muted-foreground">{disabledReason}</span>
            </div>
          }
        >
          <Button variant="outline" onClick={handleRun} disabled={running}>
            {running ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            {running ? "Menjalankan..." : "Jalankan pemeriksaan"}
          </Button>
        </Can>
      </CardContent>
      {message && <p className="px-4 pb-3 text-sm text-success-600">{message}</p>}
      {error && <p className="px-4 pb-3 text-sm text-danger-600">{error}</p>}
    </Card>
  );
}
