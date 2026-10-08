"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="flex min-h-[400px] items-center justify-center" role="status" aria-live="polite">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-danger-50">
          <ShieldAlert className="size-6 text-danger-600" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Akses terbatas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Jika Anda membutuhkan akses, hubungi administrator sistem.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  );
}
