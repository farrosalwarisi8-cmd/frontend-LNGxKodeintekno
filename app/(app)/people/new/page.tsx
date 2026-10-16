"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

/* RegistrationWizard adalah komponen berat (banyak ikon lucide, upload berkas,
 * validasi multi-langkah) — dimuat lewat dynamic import sehingga tidak ikut
 * dalam bundle halaman awal. */
const RegistrationWizard = dynamic(
  () =>
    import("@/features/people/components/registration-wizard").then(
      (mod) => mod.RegistrationWizard
    ),
  {
    loading: () => (
      <div className="mx-auto max-w-2xl py-10 space-y-4">
        <div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
        <div className="h-48 rounded-2xl border border-slate-200 bg-white animate-pulse" />
      </div>
    ),
    ssr: true,
  },
);

function RegistrationWizardLoading() {
  return (
    <div className="mx-auto max-w-2xl py-10 space-y-4">
      <div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
      <div className="h-48 rounded-2xl border border-slate-200 bg-white animate-pulse" />
    </div>
  );
}

export default function NewPersonRoute() {
  return (
    <Suspense fallback={<RegistrationWizardLoading />}>
      <RegistrationWizard />
    </Suspense>
  );
}
