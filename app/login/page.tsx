import { Suspense } from "react";
import LoginPageContent from "./login-page-content";

/** Fallback yang mirip dengan layout login agar tidak ada layout shift ekstrem. */
function LoginLoadingState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-12 animate-pulse items-center justify-center rounded-xl bg-primary-600/60" />
        <div className="h-6 w-40 animate-pulse rounded bg-border" />
        <div className="h-4 w-56 animate-pulse rounded bg-border" />
      </div>
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
      <span className="sr-only" role="status">
        Memuat halaman masuk…
      </span>
    </div>
  );
}

/**
 * Halaman /login.
 *
 * `useSearchParams()` dipakai di dalam LoginPageContent (client component),
 * sehingga page ini wajib membungkusnya dengan <Suspense> agar prerender
 * production build tidak gagal (missing-suspense-with-csr-bailout).
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingState />}>
      <LoginPageContent />
    </Suspense>
  );
}
