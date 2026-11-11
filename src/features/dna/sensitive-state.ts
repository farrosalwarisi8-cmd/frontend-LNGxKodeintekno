/**
 * A3 — State sensitif modul D&A (hanya di memori).
 *
 * Data D&A TIDAK PERNAH disimpan di localStorage/sessionStorage, tidak ditulis
 * ke URL, judul tab, log, analytics, atau pesan toast. Modul ini menampung data
 * D&A pada memori proses saja supaya bisa DIBERSIHKAN secara eksplisit:
 *  - saat pengguna meninggalkan halaman (/dna),
 *  - saat sesi berakhir (logout / currentUserId menjadi null),
 *  - saat tab ditutup (pagehide).
 *
 * Kode ini sengaja memakai cache level-modul (bukan state React) supaya
 * pembersihannya bisa diuji unit tanpa DOM.
 */
import type { BackendDaTest } from "@/lib/services/da.service";

export interface DnaSensitiveState {
  /** Daftar tes D&A yang dimuat. */
  tests: BackendDaTest[];
  /** Id tes yang sedang dipilih (penanda internal, tidak pernah di URL). */
  selectedTestId: string | null;
  /** Apakah hasil sudah dibuka secara sadar oleh pengguna. */
  resultsRevealed: boolean;
}

const EMPTY_STATE: DnaSensitiveState = {
  tests: [],
  selectedTestId: null,
  resultsRevealed: false,
};

let state: DnaSensitiveState = EMPTY_STATE;

/** Simpan state D&A (memori proses saja). */
export function setDnaSensitiveState(next: DnaSensitiveState): void {
  state = {
    tests: next.tests,
    selectedTestId: next.selectedTestId,
    resultsRevealed: next.resultsRevealed,
  };
}

/** Baca state D&A saat ini. */
export function getDnaSensitiveState(): DnaSensitiveState {
  return state;
}

/** Bersihkan seluruh state sensitif D&A. */
export function clearDnaSensitiveState(): void {
  state = { ...EMPTY_STATE, tests: [] };
}

/** Apakah masih ada data D&A yang tersimpan di memori? */
export function hasDnaSensitiveState(): boolean {
  return state.tests.length > 0 || state.selectedTestId !== null;
}
