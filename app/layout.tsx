import type { Metadata } from "next";
import "./globals.css";
import { inter } from "@/lib/fonts";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { VitalsReporter } from "@/components/vitals-reporter";

export const metadata: Metadata = {
  applicationName: "Kodein Klinik",
  title: {
    default: "Kodein Klinik — EMR PT Layar Nusantara Gas",
    template: "%s · Kodein Klinik",
  },
  description:
    "Electronic Medical Record (EMR) okupasi PT Layar Nusantara Gas: registrasi pekerja & MRN, " +
    "consent digital, MCU & Fitness to Work, kunjungan klinik, farmasi, dan sertifikat kesehatan kerja.",
  // Warna merek LNG (biru sidebar) untuk bilah browser / splash PWA.
  // `<meta name="theme-color">` wajib nilai warna literal (bukan utilitas
  // Tailwind) — pengecualian sah dari guard no-raw-colors, sama seperti aset
  // logo biner: nilainya disalin dari --c-sidebar di app/globals.css.
  /* eslint-disable rebrand/no-raw-colors -- meta theme-color wajib hex literal */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b2a4a" },
    { media: "(prefers-color-scheme: dark)", color: "#08203a" },
  ],
  /* eslint-enable rebrand/no-raw-colors */
  manifest: "/manifest.webmanifest",
  icons: {
    // Lambang LNG (public/brand/lng-flame.png) — favicon lama app/favicon.ico
    // bawaan Next digantikan ikon dari aset yang sama (Tugas 2 rebrand visible).
    icon: [
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${inter.className} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full bg-surface-page font-sans text-text-primary">
        <ErrorBoundary>{children}</ErrorBoundary>
        <Toaster />
        <VitalsReporter />
      </body>
    </html>
  );
}
