/**
 * A3 — Aturan akses &visibility hasil modul D&A.
 *
 * Akses D&A dibatasi ketat:
 *  - Dokter OH (permission `view-dna`).
 *  - HSE HANYA bila ditunjuk server. Backend belum menyediakan data penunjukan
 *    HSE untuk D&A, jadi HSE TIDAK diberi akses dan penolakan ini dicatat
 *    sebagai BLOCKER BACKEND (lihat LAPORAN_A3_OH_REVIEW_DNA.md).
 *  - Admin, HR, lab, apoteker, manajemen, perawat: TIDAK boleh.
 *
 * Hasil D&A disembunyikan secara default dan hanya ditampilkan setelah
 * tindakan sadar pengguna ("Tampilkan hasil").
 */
import type { Role } from "@/lib/types";
import { can } from "@/lib/rbac";

/** Hasil peniecatanian oleh modul D&A (bukan backend). */
export type DnaAccessReason = "allowed" | "no-permission" | "not-designated";

export interface DnaAccessDecision {
  allowed: boolean;
  reason: DnaAccessReason;
  /** Penjelasan yang jujur untuk ditampilkan ke pengguna. */
  message: string;
}

/**
 * Apakah role punya akses ke modul D&A?
 *
 * `hseDesignated` berasal dari data penunjukan server. Selama backend belum
 * mengirimkannya, nilainya `false` → HSE ditolak.
 */
export function decideDnaAccess(
  role: Role | null | undefined,
  hseDesignated = false
): DnaAccessDecision {
  if (!role) {
    return {
      allowed: false,
      reason: "no-permission",
      message: "Sesi tidak aktif, modul D&A tidak dapat dibuka.",
    };
  }
  if (can(role, "view-dna")) {
    return {
      allowed: true,
      reason: "allowed",
      message: "Akses D&A diberikan sesuai permission peran.",
    };
  }
  if (role === "hse" && !hseDesignated) {
    return {
      allowed: false,
      reason: "not-designated",
      message:
        "Akses D&A untuk HSE memerlukan penunjukan dari server. Backend belum menyediakan data penunjukan HSE untuk D&A, sehingga akses ditolak.",
    };
  }
  return {
    allowed: false,
    reason: "no-permission",
    message: "Peran Anda tidak memiliki izin untuk membuka modul D&A.",
  };
}

/** Label status reveal hasil D&A. */
export function revealLabel(revealed: boolean): string {
  return revealed ? "Hasil ditampilkan" : "Hasil disembunyikan";
}

/**
 * Apakah hasil perlu dibuka secara sadar sebelum ditampilkan?
 * Selalu ya — hasil D&A tidak pernah tampil otomatis.
 */
export function requiresExplicitReveal(): boolean {
  return true;
}

/** Teks ajakan yang ditampilkan di area hasil yang masih tersembunyi. */
export const REVEAL_PROMPT =
  "Hasil D&A disembunyikan secara default. Tampilkan hanya bila diperlukan untuk keperluan klinis — setiap akses dicatat pada audit log server.";
