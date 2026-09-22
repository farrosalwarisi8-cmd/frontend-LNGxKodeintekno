"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, QrCode, ShieldAlert } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export default function CertificateDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const cert = useStore((s) => s.certificates.find((c) => c.id === params.id));
  const employee = useStore((s) => s.employees.find((e) => e.id === cert?.employeeId));
  const revokeCertificate = useStore((s) => s.revokeCertificate);
  const [signOpen, setSignOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (!user || !cert || !employee) {
    return <div className="text-muted-foreground">Sertifikat tidak ditemukan.</div>;
  }
  const canIssue = can(user.role, "issue-certificate");
  const verifyUrl = `/verify/${cert.qrToken}`;

  return (
    <div className="space-y-4">
      <PageHeader title={`Sertifikat ${cert.certNumber}`}>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-5 text-primary" />
                <div>
                  <CardTitle>Health Certificate</CardTitle>
                  <CardDescription>Kodein Klinik — Dokumen internal perusahaan</CardDescription>
                </div>
              </div>
              <StatusBadge value={cert.status} kind="cert" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Nomor Sertifikat" value={cert.certNumber} />
              <Field label="Nama Pekerja" value={employee.fullName} />
              <Field label="Employee ID" value={employee.employeeId} />
              <Field label="Status Kesehatan Kerja" value={cert.healthStatus} />
              <Field label="Dokter Penerbit" value={cert.doctorName} />
              <Field label="Tanggal Terbit" value={formatDate(cert.issuedAt)} />
              <Field label="Masa Berlaku s.d." value={formatDate(cert.validUntil)} />
              <Field label="Verifikasi" value={`/verify/${cert.qrToken}`} />
            </div>
            {cert.restrictions && (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">Restriction:</p>
                <p>{cert.restrictions}</p>
              </div>
            )}
            {cert.status === "revoked" && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                Sertifikat ini telah dicabut (revoked) dan tidak berlaku.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-4" /> QR Verification
              </CardTitle>
              <CardDescription>Pindai QR untuk memverifikasi keaslian.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <div className="grid size-32 grid-cols-8 gap-0.5 rounded-lg border bg-black p-2">
                {Array.from({ length: 64 }).map((_, i) => {
                  const dark = ((i * 7 + cert.qrToken.length * 3) % 11) < 5;
                  return <div key={i} className={dark ? "bg-white" : "bg-black"} />;
                })}
              </div>
              <a href={verifyUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                Buka halaman verifikasi
              </a>
            </CardContent>
          </Card>

          {canIssue && cert.status === "valid" && (
            <Card>
              <CardHeader>
                <CardTitle>Aksi Dokter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => setSignOpen(true)}>
                  <BadgeCheck /> Konfirmasi Tanda Tangan
                </Button>
                <Button variant="outline" className="w-full text-destructive" onClick={() => setRevokeOpen(true)}>
                  <ShieldAlert /> Revoke Sertifikat
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Tanda Tangan Elektronik</DialogTitle>
            <DialogDescription>
              Tanda tangan elektronik demo — bukan tanda tangan tersertifikasi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                setSignOpen(false);
                toast.success("Sertifikat ditandatangani (demo).");
              }}
            >
              Tandatangani
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Sertifikat</DialogTitle>
            <DialogDescription>
              Sertifikat akan ditandai tidak berlaku tanpa menghapus riwayat.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                revokeCertificate(cert.id);
                setRevokeOpen(false);
                toast.success("Sertifikat di-revoke.");
              }}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
