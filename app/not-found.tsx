import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusActions } from "@/components/status-actions";

export const metadata: Metadata = {
  title: "Halaman Tidak Ditemukan",
  description: "Halaman yang Anda cari tidak tersedia di Kodein Klinik.",
  robots: { index: false, follow: false },
};

/**
 * Halaman 404 global — di luar shell aplikasi (rute tak dikenal tidak punya
 * sesi/menu). Merek: Logo + nama sistem, judul, penjelasan, tombol beranda.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-4 flex justify-center">
          <Logo size="lg" />
        </div>
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
          <FileQuestion className="size-6 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Kodein Klinik · PT Layar Nusantara Gas
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautan
          Anda.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <StatusActions />
        </div>
      </div>
    </div>
  );
}
