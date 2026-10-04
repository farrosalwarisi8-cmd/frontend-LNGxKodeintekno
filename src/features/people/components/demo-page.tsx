"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  UserRound,
  Users,
  Settings,
  Globe,
} from "lucide-react";
import type { DemoRole } from "../api/people.types";
import { useDemoRole } from "../hooks/use-demo-role";
import { peopleRepository } from "../api/people.repository";
import { Button } from "@/shared/components/design-system/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Switch } from "@/components/ui/switch";

const ROLES: { role: DemoRole; label: string; description: string; icon: typeof UserRound }[] = [
  { role: "ADMIN_CLINIC", label: "Admin Klinik", description: "Akses penuh ke registrasi dan consent", icon: ShieldCheck },
  { role: "HR_PIC", label: "HR/PIC", description: "Kelola pekerja dalam scope organisasi", icon: Users },
  { role: "SYSTEM_ADMIN", label: "System Administrator", description: "Akses read-only dan monitoring", icon: Settings },
  { role: "PUBLIC_WORKER", label: "Worker/Public Consent", description: "Halaman consent publik tanpa login", icon: Globe },
];

export function DemoPage() {
  const { role, setRole } = useDemoRole();
  const [config, setConfig] = useState(peopleRepository.getConfig());
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleToggle = (key: keyof typeof config) => {
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    peopleRepository.setConfig(newConfig);
  };

  const handleReset = async () => {
    setResetting(true);
    await peopleRepository.resetDemoData();
    setConfig(peopleRepository.getConfig());
    setResetting(false);
  };

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
          Demo mode — data dan permission disimulasikan di frontend.
        </div>
        <p className="mt-1 text-xs text-warning-600">
          Seluruh data pada halaman ini bersifat fiktif dan tidak menggunakan data pasien sebenarnya.
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Demo Role Switcher</h1>
        <p className="text-sm text-slate-500">Pilih role untuk mendemonstrasikan variasi UI.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ROLES.map(({ role: r, label, description, icon: Icon }) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
              role === r
                ? "border-primary-600 bg-primary-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${role === r ? "bg-primary-100 text-primary-600" : "bg-slate-100 text-slate-500"}`}>
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
          <CardTitle>Mock Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Simulate Offline</p>
              <p className="text-xs text-slate-500">Nonaktifkan semua operasi network</p>
            </div>
            <Switch checked={config.simulateOffline} onCheckedChange={() => handleToggle("simulateOffline")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Simulate Failure</p>
              <p className="text-xs text-slate-500">Semua request akan gagal</p>
            </div>
            <Switch checked={config.simulateFailure} onCheckedChange={() => handleToggle("simulateFailure")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Duplicate Scenario</p>
              <p className="text-xs text-slate-500">Duplicate check selalu mengembalikan BLOCK</p>
            </div>
            <Switch checked={config.duplicateScenario} onCheckedChange={() => handleToggle("duplicateScenario")} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Email Failure</p>
              <p className="text-xs text-slate-500">Simulasi pengiriman email gagal</p>
            </div>
            <Switch checked={config.emailFailure} onCheckedChange={() => handleToggle("emailFailure")} />
          </div>
        </CardContent>
      </Card>

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

      <div className="flex items-center justify-between">
        <Link href="/people">
          <Button variant="outline">Buka People List</Button>
        </Link>
        <Button variant="outline" onClick={handleReset} loading={resetting}>
          <RefreshCw className="size-3.5" />
          Reset Demo Data
        </Button>
      </div>
    </div>
  );
}
