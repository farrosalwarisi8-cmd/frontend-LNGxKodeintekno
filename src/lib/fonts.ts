import { Inter } from "next/font/google";

/**
 * Font tipografi aplikasi: Inter.
 *
 * next/font/google menyediakan font secara self-hosted selama build (file font
 * disajikan dari _next/static, tidak ada permintaan ke Google Fonts saat
 * runtime — penting untuk jaringan lemah).
 *
 * - `display: "swap"`: teks segera dapat dibaca dengan font sistem cadangan
 *   sementara font unduhan masih berjalan (mencegah teks tersembunyi saat
 *   memuat font).
 * - `variable: "--font-inter"`: diekspos sebagai CSS variable dan dipakai
 *   `--font-sans` di `app/globals.css`.
 * - Hanya subset latin + bobot yang dipakai UI agar paket font tetap kecil.
 */
export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600"],
  adjustFontFallback: true,
});
