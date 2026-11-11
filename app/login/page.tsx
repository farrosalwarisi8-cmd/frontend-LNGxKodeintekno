import { Suspense } from "react";
import LoginPageContent from "./login-page-content";

/** Fallback yang mirip dengan layout login agar tidak ada layout shift ekstrem. */
function LoginLoadingState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="size-10 animate-pulse rounded-2xl bg-muted" />
        <div className="h-6 w-40 animate-pulse rounded bg-border" />
        <div className="h-4 w-56 animate-pulse rounded bg-border" />
      </div>
      <div className="w-full max-w-md">
        <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
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
