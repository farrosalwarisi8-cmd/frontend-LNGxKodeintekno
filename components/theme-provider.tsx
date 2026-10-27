"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Penyedia tema aplikasi (Tugas 4 rebrand visible).
 *
 * Dark mode didefinisikan di `app/globals.css` lewat kelas `.dark`
 * (`@custom-variant dark (&:is(.dark *))`), sehingga `attribute="class"`.
 * `defaultTheme="system"` + `enableSystem`: mengikuti preferensi OS bila
 * pengguna belum memilih. next-themes menyuntikkan skrip anti-kilatan
 * sebelum hidrasi + `suppressHydrationWarning` di `<html>` mencegah
 * hydration mismatch (server selalu merender tanpa kelas).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
