"use client";

import { useParams } from "next/navigation";
import { BadgeCheck, ShieldX, QrCode } from "lucide-react";
import { useStore } from "@/lib/store";
import { CERT_STATUS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? "");
  const cert = useStore((s) => s.certificates.find((c) => c.qrToken === token));
  const employee = useStore((s) => s.employees.find((e) => e.id === cert?.employeeId));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-6">
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

        {!cert || !employee ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldX className="size-8 text-destructive" />
              <p className="font-medium">Sertifikat tidak ditemukan</p>
              <p className="text-sm text-muted-foreground">
                Token verifikasi tidak valid atau data tidak tersedia.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="text-center">
              <BadgeCheck className="mx-auto size-8 text-primary" />
              <CardTitle>Health Certificate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Nomor Sertifikat" value={cert.certNumber} />
              <Row label="Nama" value={employee.fullName} />
              <Row label="Employee ID" value={employee.employeeId} />
              <Row label="Status Kesehatan Kerja" value={cert.healthStatus} />
              {cert.restrictions && <Row label="Restriction" value={cert.restrictions} />}
              <Row label="Dokter Penerbit" value={cert.doctorName} />
              <Row label="Tanggal Terbit" value={formatDate(cert.issuedAt)} />
              <Row label="Berlaku s.d." value={formatDate(cert.validUntil)} />
              <div className="flex items-center justify-center pt-2">
                <Badge
                  variant="outline"
                  className={
                    cert.status === "valid"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }
                >
                  {CERT_STATUS[cert.status]?.label ?? cert.status}
                </Badge>
              </div>
              {cert.status !== "valid" && (
                <p className="text-center text-sm text-red-600">
                  Dokumen ini tidak berlaku.
                </p>
              )}
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
