import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "EMR PT Layar Nusantara Gas — Modul 01",
  description: "Electronic Medical Record — Registrasi Pekerja, MRN, dan Consent",
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
