/**
 * Logika status halaman consent publik (tanpa React) — dipakai
 * `src/features/people/components/public-consent.tsx` dan diuji unit.
 *
 * Gap F2-C: memastikan token invalid/used/expired dipetakan ke state yang benar
 * dan TIDAK PERNAH berubah menjadi success palsu.
 *
 * Kontrak backend (`POST /public/consents/verify`, satu-satunya jalur token):
 *  - aksi `AGREED` / `DECLINED` → keputusan tercatat
 *  - token sudah diputus / tidak dikenal / kedaluwarsa → HTTP 400
 *  - tidak ada endpoint baca token, sehingga halaman TIDAK memanggil apa pun
 *    saat dimuat (memanggil = menghabiskan token).
 */

export type ConsentPhase = "ready" | "deciding" | "done" | "used" | "invalid" | "error";

export type ConsentDecision = "APPROVED" | "REJECTED";

/** Keputusan UI → aksi yang diterima backend. */
export const CONSENT_DECISION_ACTIONS: Record<ConsentDecision, "AGREED" | "DECLINED"> = {
  APPROVED: "AGREED",
  REJECTED: "DECLINED",
};

const USED_PATTERN = /already used|no longer valid|sudah digunakan|sudah diputus/i;

/** Apakah halaman boleh memanggil API saat dimuat? Selalu tidak. */
export const CONSENT_LOADS_WITHOUT_MUTATION = true;

/**
 * Memetakan kegagalan `verifyConsent` menjadi phase UI.
 * Hanya 400 (satu-satunya penolakan token pada backend) yang dipetakan sebagai
 * used/invalid — status lain tetap `error` sehingga pengguna dapat mencoba ulang.
 */
export function resolveConsentFailurePhase(status: number, message: string): ConsentPhase {
  if (status === 400) {
    return USED_PATTERN.test(message) ? "used" : "invalid";
  }
  return "error";
}
