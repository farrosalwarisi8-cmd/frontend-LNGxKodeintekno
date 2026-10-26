"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore, useCurrentUser } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { authService, findMyEmployee } from "@/lib/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { UserRound, Building2, Phone, FileText, ShieldCheck, KeyRound } from "lucide-react";

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Profil Saya</h1>
      <p className="text-sm text-muted-foreground">Informasi data diri dan employment</p>
    </div>
  );
}

/**
 * Status MFA disimpan per akun di localStorage.
 *
 * Backend tidak mengekspos MFA status akun via endpoint yang bisa
 * dibaca semua role (GET /iam/users/:id khusus SYSTEM_ADMIN/HR_ADMIN),
 * jadi status dilacak di client setelah aksi enable/disable berhasil
 * — bukan dipalsukan sebagai hasil baca backend.
 */
const mfaStatusKey = (userId: string) => `kodein.mfa.${userId}`;

function readMfaStatus(userId: string): "enabled" | "disabled" | "unknown" {
  try {
    const v = localStorage.getItem(mfaStatusKey(userId));
    return v === "enabled" || v === "disabled" ? v : "unknown";
  } catch {
    return "unknown";
  }
}

function writeMfaStatus(userId: string, status: "enabled" | "disabled") {
  try {
    localStorage.setItem(mfaStatusKey(userId), status);
  } catch {
    // localStorage tidak tersedia (mode privat) — abaikan.
  }
}

export default function MyProfilePage() {
  const user = useCurrentUser();
  const employees = useStore((s) => s.employees);
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  // Modul 2 — data pekerja dari backend, agar profil tidak membaca seed lokal
  const { loading, error, refetch } = useSyncedModules(() => syncPatients(1, 100));

  // ---- Keamanan Akun (Modul 1 — /auth/mfa/setup | enable | disable) ----
  const [mfaStatus, setMfaStatus] = useState<"enabled" | "disabled" | "unknown">(
    user ? readMfaStatus(user.id) : "unknown"
  );
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaInfo, setMfaInfo] = useState<string | null>(null);
  // Parameter pendaftaran dari POST /auth/mfa/setup
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUri: string; account: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const startMfaSetup = async () => {
    setMfaError(null);
    setMfaInfo(null);
    setMfaBusy(true);
    try {
      // POST /auth/mfa/setup — generate secret base32 + URI otpauth:// (RFC 6238)
      const res = await authService.setupMfa();
      setMfaSetup({ secret: res.secret, otpauthUri: res.otpauthUri, account: res.account });
      setMfaInfo(res.instructions ?? "Daftarkan secret berikut ke aplikasi authenticator, lalu verifikasi dengan kode TOTP.");
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Gagal memulai setup MFA.");
    } finally {
      setMfaBusy(false);
    }
  };

  const confirmMfaEnable = async () => {
    if (!mfaSetup) return;
    if (!/^\d{6}$/.test(totpCode)) {
      setMfaError("Kode TOTP harus 6 digit angka.");
      return;
    }
    setMfaError(null);
    setMfaInfo(null);
    setMfaBusy(true);
    try {
      // POST /auth/mfa/enable — verifikasi kode TOTP pertama + aktifkan MFA
      const res = await authService.enableMfa(mfaSetup.secret, totpCode);
      setMfaStatus("enabled");
      if (user) writeMfaStatus(user.id, "enabled");
      setMfaSetup(null);
      setTotpCode("");
      setMfaInfo(res.message);
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Gagal mengaktifkan MFA.");
    } finally {
      setMfaBusy(false);
    }
  };

  const handleMfaDisable = async () => {
    setMfaError(null);
    setMfaInfo(null);
    setMfaBusy(true);
    try {
      // POST /auth/mfa/disable — nonaktifkan MFA akun
      const res = await authService.disableMfa();
      setMfaStatus("disabled");
      if (user) writeMfaStatus(user.id, "disabled");
      setMfaSetup(null);
      setTotpCode("");
      setMfaInfo(res.message);
    } catch (e) {
      setMfaError(e instanceof Error ? e.message : "Gagal menonaktifkan MFA.");
    } finally {
      setMfaBusy(false);
    }
  };

  if (!user) return null;

  const employee = findMyEmployee(employees, user);

  const securityCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Keamanan Akun
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Two-Factor Authentication (TOTP):</span>
          <Badge variant={mfaStatus === "enabled" ? "success" : mfaStatus === "disabled" ? "default" : "warning"}>
            {mfaStatus === "enabled" ? "Aktif" : mfaStatus === "disabled" ? "Nonaktif" : "Belum dikonfigurasi"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Role tertentu (mis. SYSTEM_ADMIN, DOCTOR_OH) wajib MFA menurut kebijakan
          keamanan backend. Daftarkan akun ke Google/Microsoft Authenticator melalui
          alur di bawah.
        </p>

        {mfaError && (
          <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{mfaError}</div>
        )}
        {mfaInfo && (
          <div className="rounded-xl bg-info-50 p-3 text-sm text-info-700">{mfaInfo}</div>
        )}

        {mfaStatus !== "enabled" && !mfaSetup && (
          <Button variant="outline" onClick={startMfaSetup} disabled={mfaBusy}>
            <KeyRound className="size-4" />
            Aktifkan MFA
          </Button>
        )}

        {mfaSetup && (
          <div className="space-y-3 rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">
              Akun: <span className="font-medium">{mfaSetup.account}</span>
            </p>
            <div>
              <p className="text-xs font-medium text-text-secondary">Secret key (base32)</p>
              <code className="mt-1 block rounded-lg bg-muted px-2 py-1.5 text-sm font-semibold tracking-wider break-all">
                {mfaSetup.secret}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Atau buka URI otpauth:{" "}
              <a
                href={mfaSetup.otpauthUri}
                className="font-medium text-primary-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                otpauth://…
              </a>
            </p>
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void confirmMfaEnable();
              }}
            >
              <Input
                label="Kode TOTP (6 digit)"
                inputMode="numeric"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="sm:w-40"
              />
              <div className="flex gap-2">
                <Button onClick={confirmMfaEnable} disabled={mfaBusy || totpCode.length !== 6}>
                  {mfaBusy ? "Memproses..." : "Verifikasi & Aktifkan"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMfaSetup(null);
                    setTotpCode("");
                    setMfaInfo(null);
                  }}
                  disabled={mfaBusy}
                >
                  Batal
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground">
              Environment demo/non-production mengizinkan kode OTP demo <strong>123456</strong>.
            </p>
          </div>
        )}

        {mfaStatus === "enabled" && (
          <Button variant="ghost" onClick={handleMfaDisable} disabled={mfaBusy}>
            Nonaktifkan MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Kartu akun selalu tampil: profil akun (nama, username, peran) berasal dari
  // sesi login dan tidak bergantung pada keterkaitan ke data pekerja. Ini
  // mencegah /my/profile menjadi halaman buntu "data tidak ditemukan".
  const accountCard = (
    <Card className="p-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="default">{ROLES[user.role]?.label ?? user.title}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );

  if (!employee) {
    return (
      <div className="space-y-4">
        <PageTitle />
        {accountCard}
        {securityCard}
        {error && (
          <ErrorState
            title="Gagal memuat data pekerja"
            message={error}
            onRetry={refetch}
          />
        )}
        {loading && !error && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {!loading && !error && (
          <EmptyState
            icon={UserRound}
            title="Detail pekerja belum tertaut"
            description="Akun Anda aktif, tetapi belum ditautkan ke data pekerja (MPI). Profil akun dan keamanan tetap tersedia — hubungi HR atau admin klinik bila Anda seorang pekerja."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Link href="/my/mcu">
                  <Button variant="outline" size="sm">MCU Saya</Button>
                </Link>
                <Link href="/my/certificates">
                  <Button variant="outline" size="sm">Sertifikat Saya</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Ke Dashboard</Button>
                </Link>
              </div>
            }
          />
        )}
      </div>
    );
  }

  const company = companies.find((c) => c.id === employee.companyId);
  const dept = departments.find((d) => d.id === employee.departmentId);
  const loc = locations.find((l) => l.id === employee.locationId);

  return (
    <div className="space-y-4">
      <PageTitle />

      {securityCard}

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={employee.fullName} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">{employee.fullName}</h2>
            <p className="text-sm text-muted-foreground">{employee.employeeId} · {employee.mrn}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="success">{employee.status}</Badge>
              <Badge variant="default">{employee.gender}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-muted-foreground" />
              Employment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Perusahaan:</span> {company?.name}</p>
            <p><span className="text-muted-foreground">Departemen:</span> {dept?.name}</p>
            <p><span className="text-muted-foreground">Jabatan:</span> {employee.jobTitle}</p>
            <p><span className="text-muted-foreground">Lokasi:</span> {loc?.name}</p>
            <p><span className="text-muted-foreground">Tanggal Bergabung:</span> {formatDate(employee.startDate)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="size-4 text-muted-foreground" />
              Kontak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {employee.email}</p>
            <p><span className="text-muted-foreground">Telepon:</span> {employee.phone}</p>
            <p><span className="text-muted-foreground">Tanggal Lahir:</span> {formatDate(employee.dateOfBirth)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-muted-foreground" />
            Dokumen
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
          ) : (
            <div className="space-y-2">
              {employee.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.type} · {formatDate(doc.uploadedAt)}</p>
                  </div>
                  <Badge variant="success">Verified</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
