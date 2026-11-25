import { useStore } from "@/lib/store";
import type { ExternalReferral } from "@/lib/types";

/**
 * Rujukan eksternal — mode demo.
 *
 * Backend sudah menyimpan relasi `referrals` dan mengirimkannya pada
 * `GET /clinical/encounters/:id`, tetapi belum menyediakan endpoint tulis.
 * Sampai endpoint itu tersedia, rujukan disimpan di store lokal perangkat
 * (bertahan lewat localStorage) dan ditautkan ke kunjungan yang dipilih.
 */

export interface CreateReferralInput {
  visitId: string;
  destination: string;
  reason: string;
  referralDate: string;
}

export const referralService = {
  /** Seluruh rujukan, terbaru lebih dulu. */
  list(): ExternalReferral[] {
    return useStore.getState().referrals;
  },

  /** Rujukan milik satu kunjungan, terbaru lebih dulu. */
  listForVisit(visitId: string): ExternalReferral[] {
    return useStore.getState().referrals.filter((r) => r.visitId === visitId);
  },

  /**
   * Mencatat rujukan baru dan menandai kunjungan sebagai "Referred".
   * Mengembalikan id rujukan yang dibuat.
   */
  create(input: CreateReferralInput): string {
    return useStore.getState().addReferral({
      ...input,
      destination: input.destination.trim(),
      reason: input.reason.trim(),
    });
  },
};
