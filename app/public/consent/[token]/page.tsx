import type { Metadata } from "next";
import { PublicConsent } from "@/features/people/components/public-consent";

/**
 * Halaman consent publik — tautan satu-kali dari email admin.
 *
 * Keamanan: `noindex, nofollow`, judul tab statis (token tidak pernah
 * muncul di judul/log/pesan).
 */
export const metadata: Metadata = {
  title: "Persetujuan Data Rekam Medis",
  description: "Persetujuan pemrosesan data rekam medis PT Layar Nusantara Gas.",
  robots: { index: false, follow: false },
};

export default async function PublicConsentRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicConsent token={token} />;
}
