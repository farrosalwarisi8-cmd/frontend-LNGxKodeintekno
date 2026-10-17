/**
 * Font tipografi aplikasi: Inter (fallback ke system font stack).
 *
 * Catatan: next/font/google memerlukan akses internet saat build untuk
 * mendownload font. Jika build environment tidak bisa mengakses internet,
 * gunakan font system stack sebagai fallback.
 *
 * - `variable: "--font-inter"`: diekspos sebagai CSS variable dan dipakai
 *   `--font-sans` di `app/globals.css`.
 */
export const inter = {
  className: "font-sans",
  variable: "--font-inter",
  style: {
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
};
