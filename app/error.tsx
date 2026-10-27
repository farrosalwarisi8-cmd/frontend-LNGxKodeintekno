"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { StatusActions } from "@/components/status-actions";

/**
 * Halaman error route (App Router `error.tsx`) — tampil bila segmen route
 * melempar error saat render.
 *
 * Keamanan: pesan umum saja, TIDAK menampilkan `error.message` (detail teknis
 * tidak boleh bocor ke pengguna). Log penuh tetap dicatat ke konsol untuk
 * diagnosis oleh engineer.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mb-4 flex justify-center">
          <Logo size="lg" />
        </div>
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-danger-soft">
          <AlertTriangle className="size-6 text-danger" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Terjadi Kesalahan
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          Kodein Klinik · PT Layar Nusantara Gas
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Halaman gagal dimuat. Coba lagi, atau kembali ke beranda bila masalah berlanjut.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => reset()}>
            Coba Lagi
          </Button>
          <StatusActions />
        </div>
      </div>
    </div>
  );
}
