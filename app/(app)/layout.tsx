import { EmrShell } from "@/components/emr-shell";

/**
 * Layout untuk seluruh route internal setelah login (route group `(app)`).
 *
 * Satu shell aktif: EmrShell (sidebar desktop, topbar, breadcrumb,
 * bottom navigation mobile, offline indicator, notification bell).
 * Route di luar group ini (/login, /public/*, /verify/*) tidak
 * mendapatkan shell internal.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <EmrShell>{children}</EmrShell>;
}
