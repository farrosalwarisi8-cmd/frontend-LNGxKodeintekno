"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldCheck } from "lucide-react";

const DEMO_ACCOUNTS = [
  { username: "admin", password: "admin", label: "Admin" },
  { username: "dokter", password: "dokter", label: "Dokter" },
  { username: "klinik", password: "klinik", label: "Klinik" },
  { username: "hr", password: "hr", label: "HR" },
  { username: "manajemen", password: "manajemen", label: "Manajemen" },
  { username: "pekerja", password: "pekerja", label: "Pekerja" },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useStore((s) => s.login);
  const users = useStore((s) => s.users);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function doLogin(u: string, p: string) {
    if (login(u, p)) {
      router.push("/dashboard");
    } else {
      setError("Username atau password salah.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Activity className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Kodein Klinik</h1>
        <p className="text-sm text-muted-foreground">
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
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mis. dokter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doLogin(username, password)}
                placeholder="••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={() => doLogin(username, password)}>
              <ShieldCheck /> Masuk
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
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {acc.username} / {acc.password}
                    </span>
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

      <p className="mt-6 text-xs text-muted-foreground">
        Seluruh data pada demo ini bersifat fiktif dan tidak menggunakan data pasien sebenarnya.
      </p>
    </div>
  );
}
