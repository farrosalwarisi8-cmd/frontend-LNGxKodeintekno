"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  UserRound,
  Users,
  Settings,
  Globe,
} from "lucide-react";
import type { DemoRole } from "../api/people.types";
import { DEMO_ROLE_LABELS, useDemoMode } from "@/lib/demo-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLES: { role: DemoRole; label: string; description: string; icon: typeof UserRound }[] = [
  { role: "ADMIN_CLINIC", label: "Admin Klinik", description: "Akses penuh ke registrasi dan consent", icon: ShieldCheck },
  { role: "HR_PIC", label: "HR/PIC", description: "Kelola pekerja dalam scope organisasi", icon: Users },
  { role: "SYSTEM_ADMIN", label: "System Administrator", description: "Akses read-only dan monitoring", icon: Settings },
  { role: "PUBLIC_WORKER", label: "Worker/Public Consent", description: "Halaman consent publik tanpa login", icon: Globe },
];

export function DemoPage() {
  // Demo mode: memilih role mengaktifkan mode demo; menu, bottom navigation,
  // route guard, dan tombol ikut role ini (mapping tunggal di @/lib/demo-role).
  const { enabled, demoRole, role: effectiveRole, setDemoRole, setEnabled } = useDemoMode();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-warning-700">
          <AlertTriangle className="size-4" />
          Demo mode — {enabled ? "aktif" : "non-aktif"}.
        </div>
        <p className="mt-1 text-xs text-warning-600">
          Role demo hanyalah simulasi tampilan frontend. Ia BUKAN otorisasi produksi —
          otorisasi sebenarnya tetap diverifikasi oleh backend.
        </p>
        <p className="mt-1 text-xs text-warning-600">
          Seluruh data pada halaman ini bersifat fiktif dan tidak menggunakan data pasien sebenarnya.
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Demo Role Switcher</h1>
          <Badge variant={enabled ? "warning" : "outline"}>
            {enabled ? `Demo mode: ${DEMO_ROLE_LABELS[demoRole]}` : "Demo mode non-aktif"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Pilih role untuk mendemonstrasikan variasi menu, navigasi, route guard, dan tombol.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Role efektif saat ini: <span className="font-medium text-slate-700">{effectiveRole ?? "—"}</span>
          {enabled ? " (dari demo mode)" : " (dari sesi login)"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map(({ role: r, label, description, icon: Icon }) => (
          <button
            key={r}
            onClick={() => setDemoRole(r)}
            aria-pressed={enabled && demoRole === r}
            className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
              enabled && demoRole === r
                ? "border-primary-600 bg-primary-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${enabled && demoRole === r ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="font-medium text-slate-900">{label}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public Consent Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Token Valid", token: "consent-token-person-1-1" },
            { label: "Token Expired", token: "consent-token-expired" },
            { label: "Token Delivery Failed", token: "consent-token-delivery-failed" },
            { label: "Token Invalid", token: "consent-token-unknown" },
          ].map((item) => (
            <div key={item.token} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-700">{item.label}</p>
                <p className="font-mono text-xs text-slate-500">{item.token}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(item.token, item.token)}
                  aria-label="Copy token"
                >
                  {copied === item.token ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Link href={`/public/consent/${item.token}`}>
                  <Button variant="outline" size="sm">Buka</Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/people">
          <Button variant="outline">Buka People List</Button>
        </Link>
        {enabled && (
          <Button variant="ghost" onClick={() => setEnabled(false)}>
            Nonaktifkan demo mode
          </Button>
        )}
      </div>
    </div>
  );
}
