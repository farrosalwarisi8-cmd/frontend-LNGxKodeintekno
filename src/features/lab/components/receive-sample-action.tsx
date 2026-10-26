"use client";

/**
 * Aksi "Terima sampel" — Fase A2 (Tugas 2).
 *
 * KONTRAK: klien API repo ini TIDAK punya endpoint untuk mengubah status
 * order/sampel (hanya GET daftar/detail + POST hasil + POST verify) →
 * tercatat sebagai BLOCKER BACKEND di LAPORAN_A2_LAB_RADIOLOGI.md.
 *
 * Sesuai batasan (jangan memalsukan API): tombol TAMPIL hanya bila role
 * berizin `receive-sample`, tetapi NONAKTIF dengan alasan yang jelas.
 * Tidak ada chain of custody / pemalsuan status lokal (itu Fase A3).
 */

import { TestTubeDiagonal } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { Can } from "@/components/can";

export function ReceiveSampleAction({ disabledByFlow }: { disabledByFlow?: boolean }) {
  return (
    <Can action="lab.receive-sample">
      <div className="flex flex-col gap-1">
        <div>
          <Button
            type="button"
            variant="outline"
            disabled
            aria-describedby="receive-sample-reason"
          >
            <TestTubeDiagonal className="size-4" aria-hidden="true" /> Terima sampel
          </Button>
        </div>
        <p id="receive-sample-reason" className="text-xs text-muted-foreground">
          {disabledByFlow
            ? "Sampel tidak dapat diterima untuk order ini (status tidak mendukung)."
            : "Penerimaan sampel membutuhkan pembaruan status order dari backend; endpoint " +
              "tersebut belum tersedia (BLOCKER BACKEND) sehingga aksi dinonaktifkan."}
        </p>
      </div>
    </Can>
  );
}
