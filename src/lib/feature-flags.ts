/**
 * Feature flag lingkungan (frontend-only).
 *
 * Fase A2 (Laboratorium & Radiologi) dibungkus flag agar merge ke main tidak
 * mengubah perilaku yang ada: saat flag mati (default), menu/route baru tidak
 * tampil dan halaman baru menampilkan status nonaktif.
 *
 * Pembacaan env tetap terpusat di `src/lib/env.ts` (satu-satunya pembaca
 * `NEXT_PUBLIC_*` — dijaga test audit konfigurasi frontend).
 */

import { isFeatureLabEnabled } from "@/lib/env";

/**
 * Flag workspace Lab & Radiologi (Fase A2).
 * Kontrol: item menu "Radiologi" dan konten workspace baru di route /lab*.
 * Default: MATI.
 */
export function isLabRadiologyEnabled(): boolean {
  return isFeatureLabEnabled();
}
