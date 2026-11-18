import type { Metadata } from "next";
import { VerifyView } from "@/components/verify-view";
import { decodeVerifyToken } from "@/features/tte/verify-state";

/**
 * Halaman verifikasi publik — token bertanda tangan di URL.
 *
 * Keamanan: `noindex, nofollow` (halaman bertoken tidak boleh terindeks),
 * judul tab statis (token tidak pernah muncul di judul/log/pesan).
 */
export const metadata: Metadata = {
  title: "Verifikasi Sertifikat",
  description: "Verifikasi keaslian sertifikat kesehatan kerja PT Layar Nusantara Gas.",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // decode aman: URI malformed tidak boleh menabrak error boundary publik,
  // dan token tidak pernah dicatat ke log maupun judul halaman.
  return <VerifyView token={decodeVerifyToken(token)} />;
}
