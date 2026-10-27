"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  ShieldX,
  ShieldQuestion,
  Loader2,
  Award,
  Printer,
} from "lucide-react";
import { documentService, type PublicVerifyResult } from "@/lib/services/document.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/public-shell";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * Verifikasi publik dokumen medis via QR token (Tugas 5 rebrand visible).
 * Backend: GET /api/v1/public/verify/:qrToken (zero medical disclosure).
 *
 * - Hanya field yang SUDAH ditampilkan sebelumnya (kontrak
 *   PublicVerifyResult) — tidak ada data tambahan, tidak ada data sensitif.
 * - Token tidak pernah ditampilkan di UI, judul tab, log, maupun pesan error.
 * - Tiap status memakai ikon + judul + penjelasan (tidak bergantung warna).
 * - Aman cetak: `print:` menghapus latar berat/bayangan.
 */
export function VerifyView({ token }: { token: string }) {
  const [result, setResult] = useState<PublicVerifyResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (!token) {
        if (alive) setLoading(false);
        return;
      }
      setLoading(true);
      documentService
        .verifyPublic(token)
        .then((res) => {
          if (alive) setResult(res);
        })
        .catch((e: unknown) => {
          if (alive) setFetchError(e instanceof Error ? e.message : "Gagal memverifikasi token.");
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

  const verified = result?.isValid === true;

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

        {!loading && fetchError && !result && (
          <Card className="print:border-border print:shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className={`flex size-12 items-center justify-center rounded-2xl bg-danger-soft ${PRINT_PAPER}`}>
                <ShieldQuestion className="size-6 text-danger" aria-hidden="true" />
              </span>
              <p className="font-medium text-foreground">Tidak dapat memverifikasi</p>
              <p className="text-sm text-muted-foreground">{fetchError}</p>
              <p className="text-xs text-muted-foreground">
                Periksa koneksi Anda lalu muat ulang halaman, atau minta tautan baru dari klinik.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && result && !verified && (
          <Card className="print:border-border print:shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <span className={`flex size-12 items-center justify-center rounded-2xl bg-danger-soft ${PRINT_PAPER}`}>
                <ShieldX className="size-6 text-danger" aria-hidden="true" />
              </span>
              <p className="font-medium text-foreground">Sertifikat tidak valid</p>
              <p className="text-sm text-muted-foreground">
                {result.message ?? `Status: ${result.status}`}
              </p>
              <p className="text-xs text-muted-foreground">
                Tautan mungkin kedaluwarsa atau sudah dipakai. Minta tautan baru dari klinik bila
                diperlukan.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && verified && result && (
          <Card className={`print:border-border ${PRINT_PAPER} print:shadow-none`}>
            <CardHeader className="text-center">
              <span className={`mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-success-soft ${PRINT_PAPER}`}>
                <BadgeCheck className="size-6 text-success" aria-hidden="true" />
              </span>
              <CardTitle>Health Certificate</CardTitle>
              <CardDescription>Dokumen terverifikasi dari penerbit resmi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Judul Dokumen" value={result.documentTitle ?? ""} />
              <Row label="Jenis Dokumen" value={result.documentType ?? ""} />
              <Row label="Penerbit" value={result.issuer ?? ""} />
              <Row label="Tanggal Terbit" value={formatDateTime(result.issuedAt)} />

              {result.signatures && result.signatures.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tanda Tangan Digital
                  </p>
                  {result.signatures.map((sig, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-xl border border-border bg-muted px-3 py-2 ${PRINT_PAPER}`}
                    >
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-primary" aria-hidden="true" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{sig.type ?? "PSrE"}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {sig.certificateSerial ?? "—"}
                          </p>
                        </div>
                      </div>
                      {sig.signedAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(sig.signedAt)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-center gap-2 pt-2">
                <Badge variant="outline" className="bg-success-soft text-success">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {result.status}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="print:hidden"
                >
                  <Printer className="size-3.5" aria-hidden="true" /> Cetak
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}

/**
 * Cetak di kertas putih pada kedua mode — pengecualian sah dari guard warna
 * (latar token dark akan boros tinta dan tidak terbaca bila dicetak).
 */
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
