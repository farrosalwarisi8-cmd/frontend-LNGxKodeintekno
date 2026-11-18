"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ShieldX,
  ShieldQuestion,
  Clock,
  Ban,
  FileClock,
  Loader2,
  Printer,
} from "lucide-react";
import { documentService, type PublicVerifyResult } from "@/lib/services/document.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { formatDateTime } from "@/lib/format";
import {
  classifyVerifyResult,
  type VerifyUiState,
} from "@/features/tte/verify-state";

/**
 * Verifikasi publik dokumen medis via QR token.
 * Backend: GET /api/v1/public/verify/:qrToken (zero medical disclosure).
 *
 * - Token tidak pernah ditampilkan di UI, judul tab, log, console, maupun
 *   pesan error, dan tidak disimpan ke localStorage.
 * - Status tampil berdasarkan response backend. Status tidak dikenali TIDAK
 *   pernah dinyatakan valid.
 * - Backend saat ini belum memisahkan EXPIRED/REVOKED; kedua state disiapkan
 *   untuk status yang kelak dikirim backend, bukan hasil tebakan frontend.
 */

const STATE_ICON: Record<VerifyUiState, typeof BadgeCheck> = {
  valid: BadgeCheck,
  "found-unsigned": FileClock,
  invalid: ShieldX,
  expired: Clock,
  revoked: Ban,
  "expired-or-invalid": ShieldQuestion,
  "backend-error": ShieldQuestion,
  empty: ShieldQuestion,
};

export function VerifyView({ token }: { token: string }) {
  const [result, setResult] = useState<PublicVerifyResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!token) {
        setResult(null);
        setFetchError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      documentService
        .verifyPublic(token)
        .then((res) => {
          if (alive) setResult(res);
        })
        .catch(() => {
          // Pesan backend sengaja tidak dipakai; token tidak pernah di-log.
          if (alive) setFetchError("Verifikasi tidak dapat diselesaikan.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token]);

  const view = classifyVerifyResult(result, {
    hasToken: Boolean(token),
    hasError: Boolean(fetchError),
  });
  const Icon = STATE_ICON[view.state];
  const isProblem = view.state !== "valid" && view.state !== "found-unsigned";

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Verifikasi Sertifikat
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Halaman verifikasi publik — hanya informasi minimum yang ditampilkan.
          </p>
        </div>

        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground" role="status">
                Memeriksa token ke backend...
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && (
          <Card className={`print:border-border ${PRINT_PAPER} print:shadow-none`}>
            <CardHeader className="text-center">
              <span
                className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl ${
                  isProblem ? "bg-danger-soft" : "bg-success-soft"
                } ${PRINT_PAPER}`}
              >
                <Icon className={`size-6 ${isProblem ? "text-danger" : "text-success"}`} aria-hidden="true" />
              </span>
              <CardTitle>{view.title}</CardTitle>
              <CardDescription>
                {view.state === "valid" ? "Status: terverifikasi" : view.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {view.state !== "valid" && (
                <>
                  <p className="text-center text-sm text-muted-foreground" role="status">
                    {view.description}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">{view.hint}</p>
                  {view.statusLabel && (
                    <p className="text-center">
                      <Badge variant="outline">Status backend: {view.statusLabel}</Badge>
                    </p>
                  )}
                </>
              )}

              {view.showAsValid && result && (
                <>
                  <Row label="Jenis Dokumen" value={result.documentType ?? ""} />
                  <Row label="Nomor Dokumen" value={result.documentNumber ?? ""} />
                  <Row label="Tanggal Terbit" value={formatDateTime(result.issuedAt)} />
                  <Row label="Waktu Tanda Tangan" value={formatDateTime(result.signedAt ?? undefined)} />
                  <Row label="Serial Sertifikat" value={result.certificateSerial ?? ""} />
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Badge variant="outline" className="bg-success-soft text-success">
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                      TERVERIFIKASI
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.print()}
                      className="min-h-11 print:hidden"
                    >
                      <Printer className="size-3.5" aria-hidden="true" /> Cetak
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}

/** Cetak di kertas putih pada kedua mode — pengecualian sah dari guard warna. */
// eslint-disable-next-line rebrand/no-raw-colors -- cetak: kertas putih di kedua mode
const PRINT_PAPER = "print:bg-white";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}
