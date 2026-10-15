"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { resolveLoginRedirect } from "@/lib/navigation";
import { ROLES } from "@/lib/constants";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { environmentLabel, getDemoPassword, isDemoModeEnabled } from "@/lib/env";
import { Activity, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";

/**
 * Akun uji seed backend (deployment demo/development).
 *
 * GAP F1-C: password demo TIDAK lagi ditulis di source. Daftar ini hanya
 * ditampilkan bila demo mode diminta eksplisit (`NEXT_PUBLIC_ENABLE_DEMO=true`)
 * DAN `NEXT_PUBLIC_DEMO_PASSWORD` tersedia, sehingga build production normal
 * tidak memuat kredensial apa pun.
 */
const DEMO_ACCOUNTS: ReadonlyArray<{ username: string; label: string; role: string }> = [
  { username: "admin", label: "Admin Sistem", role: "admin" },
  { username: "dr.hendra", label: "Dokter Sp.Oh", role: "dokter-oh" },
  { username: "dr.klinik", label: "Dokter Klinik", role: "dokter-klinik" },
  { username: "perawat", label: "Perawat", role: "perawat" },
  { username: "apoteker", label: "Apoteker", role: "apoteker" },
  { username: "lab.analis", label: "Analis Lab", role: "lab" },
  { username: "hr.pic", label: "HR/PIC", role: "hr" },
  { username: "hse.officer", label: "HSE Officer", role: "hse" },
  { username: "hse.manager", label: "HSE Manager", role: "hse" },
  { username: "manajemen", label: "Manajemen", role: "manajemen" },
];

const DEMO_MODE_ENABLED = isDemoModeEnabled();
const DEMO_PASSWORD = DEMO_MODE_ENABLED ? getDemoPassword() : "";
const DEMO_ACCOUNTS_READY = DEMO_MODE_ENABLED && DEMO_PASSWORD.length > 0;

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000;

export default function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useStore((s) => s.login);
  const verifyMfa = useStore((s) => s.verifyMfa);
  const users = useStore((s) => s.users);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaSetupRequired, setMfaSetupRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const doLogin = async (u: string, p: string) => {
    if (isLocked) {
      setError(`Akun terkunci. Coba lagi dalam ${lockoutTimer} detik.`);
      return;
    }

    if (!u.trim() || !p.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    const result = await login(u, p);
    setIsSubmitting(false);

    if (result.ok) {
      const from = searchParams.get("from");
      router.push(resolveLoginRedirect(from));
    } else if (result.mfaRequired && result.userId) {
      setMfaUserId(result.userId);
      setMfaSetupRequired(result.mfaSetupRequired === true);
      setError("");
    } else {
      attemptsRef.current += 1;
      const remaining = MAX_ATTEMPTS - attemptsRef.current;
      if (remaining <= 0) {
        handleLockout();
      } else {
        setError(
          `${result.error ?? "Username atau password salah."} Sisa percobaan: ${remaining}`
        );
      }
    }
  };

  const doVerifyMfa = async () => {
    if (!/^\d{6}$/.test(mfaCode)) {
      setError("Kode MFA harus 6 digit angka.");
      return;
    }

    if (!mfaUserId) return;
    const result = await verifyMfa(mfaUserId, mfaCode);
    if (result.ok) {
      const from = searchParams.get("from");
      router.push(resolveLoginRedirect(from));
    } else {
      setError(result.error ?? "Kode MFA salah.");
    }
  };

  if (mfaUserId) {
    const mfaUser =
      users.find((u) => u.id === mfaUserId) ?? users.find((u) => u.username === username);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary-600">
            <KeyRound className="size-6 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Verifikasi MFA</h1>
          <p className="text-sm text-slate-500">
            {mfaSetupRequired
              ? "Akun Anda wajib mengaktifkan Two-Factor Authentication (TOTP)."
              : "Masukkan kode 6 digit dari aplikasi authenticator Anda"}
          </p>
        </div>

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Akun: {mfaUser?.name ?? username} ({mfaUser?.username ?? username})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mfaSetupRequired && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                Kebijakan keamanan mewajibkan MFA untuk peran Anda. Pada environment
                demo/non-production, backend mengizinkan kode OTP demo <strong>123456</strong>{" "}
                untuk menyelesaikan login. Pada production, daftarkan akun ke aplikasi
                authenticator (Google/Microsoft Authenticator) lebih dahulu.
              </div>
            )}
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
                setMfaSetupRequired(false);
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
          Occupational Health &amp; Clinic Management
        </p>
        <Badge variant="outline" data-testid="environment-label">
          {environmentLabel()}
        </Badge>
      </div>

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Masuk</CardTitle>
            <CardDescription>
              {DEMO_ACCOUNTS_READY
                ? "Gunakan akun demo di samping atau isi manual."
                : "Masukkan username dan password akun Anda."}
            </CardDescription>
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
            <Button className="w-full" onClick={() => doLogin(username, password)} disabled={isLocked || isSubmitting}>
              <ShieldCheck className="size-4" /> {isSubmitting ? "Memeriksa..." : "Masuk"}
            </Button>
          </CardContent>
        </Card>

        {DEMO_ACCOUNTS_READY && (
          <Card>
            <CardHeader>
              <CardTitle>Akun Demo</CardTitle>
              <CardDescription>
                Akun seed backend pada environment demo. Klik untuk login cepat.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2" data-testid="demo-accounts">
              {DEMO_ACCOUNTS.map((acc) => {
                const roleMeta = ROLES[acc.role as keyof typeof ROLES];
                return (
                  <button
                    key={acc.username}
                    onClick={() => doLogin(acc.username, DEMO_PASSWORD)}
                    disabled={isLocked || isSubmitting}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{acc.label}</span>
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
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Seluruh data pada demo ini bersifat fiktif dan tidak menggunakan data pasien sebenarnya.
      </p>
    </div>
  );
}
