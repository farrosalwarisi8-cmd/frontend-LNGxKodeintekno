import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mode Offline",
  description: "Halaman fallback saat perangkat tidak terhubung ke jaringan.",
};

/**
 * Halaman fallback service worker (`/offline`).
 *
 * Sengaja tidak bergantung pada data backend maupun store: halaman ini harus
 * bisa dirender dari cache saat perangkat benar-benar tanpa jaringan.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Anda sedang offline</h1>
        <p className="text-sm text-muted-foreground">
          Aplikasi tetap dapat dibuka. Catatan yang Anda simpan sekarang akan masuk ke
          antrean IndexedDB dan dikirim otomatis saat koneksi pulih.
        </p>
        <p className="text-xs text-muted-foreground">
          Jangan menutup tab selama sinkronisasi berjalan. Status antrean dapat dilihat di
          halaman Emergency.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link
            href="/emergency"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Buka Emergency Mode
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            Coba Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
