/**
 * Masking identifier TTE untuk ditampilkan di UI.
 *
 * ID request tanda tangan (UUID/opaque) bukan rahasia sesi, tetapi tidak perlu
 * ditampilkan penuh pada konfirmasi retry maupun pesan status: cukup bagian
 * awal/akhir agar pengguna tetap dapat membedakan request lama dan baru.
 *
 * Aturan:
 *  - Nilai kosong tidak pernah ditampilkan sebagai ID palsu ("—").
 *  - Tidak ada karakter asli yang hilang dari indikator `…`.
 *  - Fungsi murni; tidak menyentuh storage, console, atau jaringan.
 */
export function maskId(value: string | null | undefined): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "—";
  if (raw.length <= 2) return `${raw.slice(0, 1)}…`;
  if (raw.length <= 8) return `${raw.slice(0, 2)}…${raw.slice(-2)}`;
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`;
}
