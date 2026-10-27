"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Tombol aksi untuk halaman status standalone (404/error) — client component
 * agar bisa memakai `buttonVariants` (modul "use client") dan `router.back()`.
 *
 * - `Kembali`: kembali ke halaman sebelumnya (riwayat browser).
 * - `Beranda`: tautan ke rute yang diberikan, tampil sebagai tombol primer.
 *
 * Tanpa margin sendiri — pemanggil yang mengatur jarak (`mt-6`).
 */
export function StatusActions({ homeHref = "/dashboard" }: { homeHref?: string }) {
  const router = useRouter();
  return (
    <>
      <Button variant="outline" onClick={() => router.back()}>
        Kembali
      </Button>
      <Link href={homeHref} className={buttonVariants()}>
        Kembali ke Beranda
      </Link>
    </>
  );
}
