/**
 * A3 — Chain of custody D&A (tampilan hanya-baca, append-only).
 *
 * Kejadian custody bersifat append-only: frontend hanya MENAMBAHKAN kejadian
 * baru (POST /da/samples/:id/chain-of-custody). Tidak ada aksi edit/hapus —
 * endpoint-nya memang tidak ada.
 */
import type { BackendCustodyEntry } from "@/lib/services/da.service";

/** Kosakata aksi custody dari API (dipakai untuk label tampilan). */
const ACTION_LABELS: Record<string, string> = {
  SAMPLE_COLLECTED_AND_SEALED: "Sampel dikumpulkan & disegel",
  SAMPLE_COLLECTED: "Sampel dikumpulkan",
  SEALED: "Sampel disegel",
  HANDED_TO_COURIER: "Diserahkan ke kurir",
  HANDED_TO_LAB: "Diserahkan ke laboratorium",
  RECEIVED_BY_LAB: "Diterima oleh laboratorium",
  ANALYSIS_STARTED: "Analisis dimulai",
  ANALYSIS_COMPLETED: "Analisis selesai",
  RESULTS_REPORTED: "Hasil dilaporkan",
  STORED: "Disimpan",
  DISPOSED: "Dibuang",
};

/** Label aksi custody; nilai tak dikenal ditampilkan apa adanya. */
export function custodyActionLabel(action: string | null | undefined): string {
  if (!action) return "Aksi tidak tersedia dari API";
  return ACTION_LABELS[action.trim().toUpperCase()] ?? action;
}

/** Satu baris lini waktu custody. */
export interface CustodyTimelineEntry {
  id: string;
  actionLabel: string;
  /** Pelaku pengirim (dari API). */
  fromParty: string;
  /** Pelaku penerima (dari API). */
  toParty: string;
  /** Waktu kejadian (dari API). */
  eventAt: string | null;
  /** Keterangan tambahan bila API mengirimkannya. */
  note: string | null;
  /** Tanda tangan hash (potongan pendek) dari API. */
  signatureHash: string | null;
}

/** Bangun lini waktu custody dari data API (urutan waktu server). */
export function toCustodyTimeline(
  entries: readonly BackendCustodyEntry[] | null | undefined
): CustodyTimelineEntry[] {
  return (entries ?? [])
    .filter((entry) => Boolean(entry?.id))
    .map((entry) => ({
      id: entry.id,
      actionLabel: custodyActionLabel(entry.action),
      fromParty: entry.from_party?.trim() || "Tidak tersedia dari API",
      toParty: entry.to_party?.trim() || "Tidak tersedia dari API",
      eventAt: entry.event_at ?? null,
      note: (entry as { note?: string | null }).note ?? null,
      signatureHash: entry.signature_hash?.trim() || null,
    }));
}
