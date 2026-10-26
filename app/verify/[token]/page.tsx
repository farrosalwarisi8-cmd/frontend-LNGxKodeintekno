"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeCheck, ShieldX, QrCode, Loader2, FileText, User, Calendar, Award } from "lucide-react";
import { documentService, type PublicVerifyResult } from "@/lib/services/document.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * Modul 9 — Verifikasi publik dokumen medis via QR token.
 * Backend: GET /api/v1/public/verify/:qrToken (zero medical disclosure).
 *
 * Fase 6 — Enhanced: tampilan signature detail dengan certificate serial.
 */
export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? "");

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <QrCode className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Verifikasi Sertifikat</h1>
          <p className="text-sm text-muted-foreground">
            Halaman verifikasi publik — hanya informasi minimum yang ditampilkan.
          </p>
        </div>

        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Memeriksa token ke backend...</p>
            </CardContent>
          </Card>
        )}

        {!loading && fetchError && !result && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldX className="size-8 text-destructive" />
              <p className="font-medium">Tidak dapat memverifikasi</p>
              <p className="text-sm text-muted-foreground">{fetchError}</p>
            </CardContent>
          </Card>
        )}

        {!loading && result && !verified && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldX className="size-8 text-destructive" />
              <p className="font-medium">Sertifikat tidak ditemukan</p>
              <p className="text-sm text-muted-foreground">
                {result.message ?? `Status: ${result.status}`}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && verified && result && (
          <Card>
            <CardHeader className="text-center">
              <BadgeCheck className="mx-auto size-8 text-primary" />
              <CardTitle>Health Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Judul Dokumen" value={result.documentTitle ?? ""} />
              <Row label="Jenis Dokumen" value={result.documentType ?? ""} />
              <Row label="Penerbit" value={result.issuer ?? ""} />
              <Row label="Tanggal Terbit" value={formatDateTime(result.issuedAt)} />

              {/* Fase 6 — Signature detail */}
              {result.signatures && result.signatures.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tanda Tangan Digital
                  </p>
                  {result.signatures.map((sig, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Award className="size-4 text-primary" />
                        <div>
                          <p className="text-xs font-medium">{sig.type ?? "PSrE"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
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

              <div className="flex items-center justify-center pt-2">
                <Badge
                  variant="outline"
                  className="bg-success-100 text-success-600 dark:bg-success-600 dark:text-success-foreground"
                >
                  {result.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
