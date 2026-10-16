import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  applicationName: "Kodein Klinik",
  title: {
    default: "Kodein Klinik — EMR Okupasi & Klinik Perusahaan",
    template: "%s · Kodein Klinik",
  },
  description:
    "Electronic Medical Record (EMR) okupasi: registrasi pekerja & MRN, consent digital, " +
    "MCU & Fitness to Work, kunjungan klinik, farmasi, dan sertifikat kesehatan kerja.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-surface-page font-sans text-text-primary">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
