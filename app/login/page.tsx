"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Activity, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";

const DEMO_ACCOUNTS = [
  { username: "admin", password: "admin", label: "Admin Sistem" },
  { username: "dokter", password: "dokter", label: "Dokter OH" },
  { username: "klinik", password: "klinik", label: "Perawat" },
  { username: "hr", password: "hr", label: "HR/PIC" },
  { username: "manajemen", password: "manajemen", label: "Manajemen" },
  { username: "pekerja", password: "pekerja", label: "Pekerja" },
  { username: "dokter-klinik", password: "dokter", label: "Dokter Klinik" },
  { username: "apoteker", password: "apoteker", label: "Apoteker" },
  { username: "lab", password: "lab", label: "Analis Lab" },
  { username: "admin-klinik", password: "klinik", label: "Admin Klinik" },
  { username: "hse", password: "hse", label: "HSE" },
];

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useStore((s) => s.login);
  const verifyMfa = useStore((s) => s.verifyMfa);
  const users = useStore((s) => s.users);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const attemptsRef = useRef(0);
  const lockoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLockout = useCallback(() => {
    setIsLocked(true);
    setLockoutTimer(MAX_ATTEMPTS);
    setError(`Terlalu banyak percobaan. Coba lagi dalam ${MAX_ATTEMPTS} detik.`);

    if (lockoutRef.current) clearTimeout(lockoutRef.current);

    let remaining = MAX_ATTEMPTS;
    const interval = setInterval(() => {
      remaining -= 1;
      setLockoutTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setIsLocked(false);
        attemptsRef.current = 0;
        setError("");
      }
    }, 1000);

    lockoutRef.current = interval;
  }, []);

  const doLogin = (u: string, p: string) => {
    if (isLocked) {
      setError(`Akun terkunci. Coba lagi dalam ${lockoutTimer} detik.`);
      return;
    }

    if (!u.trim() || !p.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    const result = login(u, p);
    if (result.ok) {
      const from = searchParams.get("from");
      router.push(from || "/dashboard");
    } else if (result.mfaRequired && result.userId) {
      setMfaUserId(result.userId);
      setError("");
    } else {
      attemptsRef.current += 1;
      const remaining = MAX_ATTEMPTS - attemptsRef.current;
      if (remaining <= 0) {
        handleLockout();
      } else {
        setError(`Username atau password salah. Sisa percobaan: ${remaining}`);
      }
    }
  };

  const doVerifyMfa = () => {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Kode MFA harus 6 digit angka.");
      return;
    }

    if (mfaUserId && verifyMfa(mfaUserId, mfaCode)) {
      const from = searchParams.get("from");
      router.push(from || "/dashboard");
    } else {
      setError("Kode MFA salah.");
    }
  };

  if (mfaUserId) {
    const mfaUser = users.find((u) => u.id === mfaUserId);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-600">
            <KeyRound className="size-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Verifikasi MFA</h1>
          <p className="text-sm text-slate-500">
            Masukkan kode 6 digit dari aplikasi authenticator Anda
          </p>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Akun: {mfaUser?.name} ({mfaUser?.username})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Kode MFA"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && doVerifyMfa()}
              placeholder="123456"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </div>
            )}
            <Button className="w-full" onClick={doVerifyMfa}>
              <ShieldCheck className="size-4" /> Verifikasi
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setMfaUserId(null);
                setMfaCode("");
                setError("");
              }}
            >
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary-600">
          <Activity className="size-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Kodein Klinik</h1>
        <p className="text-sm text-slate-500">
          Occupational Health & Clinic Management — Demo Awal
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>Gunakan akun demo di bawah atau isi manual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mis. dokter"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doLogin(username, password)}
              placeholder="••••••"
            />
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                <AlertTriangle className="size-4 shrink-0" />
                {error}
              </div>
            )}
            <Button className="w-full" onClick={() => doLogin(username, password)} disabled={isLocked}>
              <ShieldCheck className="size-4" /> Masuk
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Akun Demo</CardTitle>
            <CardDescription>Klik untuk login cepat dengan role berbeda.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const user = users.find((u) => u.username === acc.username);
              if (!user) return null;
              const roleMeta = ROLES[user.role];
              return (
                <button
                  key={acc.username}
                  onClick={() => doLogin(acc.username, acc.password)}
                  disabled={isLocked}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-slate-500">@{acc.username}</span>
                  </div>
                  <Badge variant="outline" className={roleMeta.color}>
                    {roleMeta.label}
                  </Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Seluruh data pada demo ini bersifat fiktif dan tidak menggunakan data pasien sebenarnya.
      </p>
    </div>
  );
}
