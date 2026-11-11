import type { Metadata } from "next";
import { VerifyView } from "@/components/verify-view";

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
  return <VerifyView token={decodeURIComponent(token ?? "")} />;
}
