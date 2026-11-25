/**
 * Route publik (boleh diakses tanpa sesi).
 *
 * `/demo` TIDAK publik: halaman demo role internal yang membutuhkan login
 * (keputusan resmi Tahap 2 — lihat ACCESS_ARCHITECTURE.md).
 *
 * `/offline` publik karena halaman ini adalah fallback service worker: saat
 * jaringan mati, redirect ke /login yang belum pernah di-cache justru
 * membuat aplikasi tidak bisa dibuka sama sekali.
 */
export const PUBLIC_PATHS: readonly string[] = [
  "/login",
  "/public",
  "/verify",
  "/offline",
];

/** Normalisasi path: gabung slash ganda, buang trailing slash. */
export function normalizePath(pathname: string): string {
  return pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function isPublicPath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  return PUBLIC_PATHS.some(
    (path) => normalized === path || normalized.startsWith(`${path}/`)
  );
}
