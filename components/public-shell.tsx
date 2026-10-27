import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Kerangka halaman publik (Tugas 5 rebrand visible): consent publik dan
 * verifikasi sertifikat — TANPA shell aplikasi (tanpa sidebar/nav/user menu).
 *
 * - Kop: Logo + nama sistem + nama perusahaan (alt dekoratif, nama di samping).
 * - Area konten berlebar nyaman (maks ~720px), mobile-first.
 * - Footer sederhana. Pengalih tema di pojok (DOM setelah main agar Tab
 *   konten tetap lebih dulu).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="relative border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 pr-20 md:px-6 md:pr-6">
          <Logo size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Kodein Klinik</p>
            <p className="truncate text-xs text-muted-foreground">PT Layar Nusantara Gas</p>
          </div>
          {/* Pengalih tema di kop header (kanan). Di DOM setelah judul agar
              urutan Tab mulai dari konten; penempatan visual via absolute. */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 md:right-6">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-6">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>Kodein Klinik · PT Layar Nusantara Gas</p>
          <p>Halaman resmi verifikasi &amp; persetujuan dokumen.</p>
        </div>
      </footer>
    </div>
  );
}
