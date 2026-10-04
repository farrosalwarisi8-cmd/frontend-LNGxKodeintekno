"use client";

import { useState } from "react";
import { ShieldCheck, CircleCheck, Clock3, AlertTriangle, XCircle } from "lucide-react";
import type { TokenState } from "../api/people.types";
import { useConsentByToken, useDecideConsent } from "../hooks/use-consent";
import { Button } from "@/shared/components/design-system/button";
import { Card } from "@/shared/components/design-system/card";
import { Modal } from "@/shared/components/design-system/modal";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDateTime } from "@/shared/utils/date";

const TOKEN_STATE_CONFIG: Record<TokenState, { icon: typeof ShieldCheck; color: string; title: string; message: string }> = {
  VALID: { icon: ShieldCheck, color: "text-primary-600", title: "Link Consent Aktif", message: "Silakan baca dan pilih persetujuan Anda." },
  EXPIRED: { icon: Clock3, color: "text-warning-600", title: "Link Sudah Kedaluwarsa", message: "Link ini sudah tidak aktif. Minta admin mengirim link baru." },
  USED: { icon: CircleCheck, color: "text-success-600", title: "Link Sudah Digunakan", message: "Consent sudah pernah diproses dengan link ini." },
  REVOKED: { icon: XCircle, color: "text-danger-600", title: "Link Dicabut", message: "Link consent ini telah dicabut." },
  INVALID: { icon: AlertTriangle, color: "text-danger-600", title: "Link Tidak Valid", message: "Link consent tidak dapat digunakan. Silakan minta link baru dari admin." },
  DELIVERY_FAILED: { icon: AlertTriangle, color: "text-danger-600", title: "Pengiriman Gagal", message: "Email consent tidak dapat dikirim. Hubungi admin." },
};

export function PublicConsent({ token }: { token: string }) {
  const { data, loading, error } = useConsentByToken(token);
  const { decide, loading: deciding } = useDecideConsent();
  const [showConfirm, setShowConfirm] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [success, setSuccess] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-6">
          <div className="space-y-4">
            <Skeleton className="mx-auto size-12 rounded-full" />
            <Skeleton className="mx-auto h-6 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 size-12 text-danger-600" />
          <h1 className="text-lg font-semibold text-slate-900">Kesalahan</h1>
          <p className="mt-2 text-sm text-slate-500">{error ?? "Tidak dapat memuat data."}</p>
        </Card>
      </div>
    );
  }

  const stateConfig = TOKEN_STATE_CONFIG[data.state];
  const StateIcon = stateConfig.icon;

  const handleDecide = async () => {
    if (!showConfirm) return;
    try {
      await decide(token, showConfirm);
      setSuccess(true);
      setShowConfirm(null);
    } catch {
      // error handled by hook
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CircleCheck className="mx-auto mb-4 size-16 text-success-600" />
          <h1 className="text-xl font-semibold text-slate-900">Persetujuan berhasil dicatat</h1>
          <p className="mt-2 text-sm text-slate-500">Terima kasih. Anda dapat menutup halaman ini.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 p-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-100">
            <ShieldCheck className="size-6 text-primary-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">PT Layar Nusantara Gas</h1>
          <p className="text-sm text-slate-500">Electronic Medical Record Consent</p>
        </div>

        <div className="p-6">
          <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 ${data.state === "VALID" ? "bg-primary-50 text-primary-700" : "bg-danger-50 text-danger-700"}`}>
            <StateIcon className="size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{stateConfig.title}</p>
              <p className="text-xs opacity-80">{stateConfig.message}</p>
            </div>
          </div>

          {data.state === "VALID" && (
            <>
              <div className="mb-4 space-y-2">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Nama:</span> {data.personName}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Tipe Consent:</span> {data.consentType}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Versi:</span> {data.consentVersion}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Berlaku hingga:</span> {formatDateTime(data.expiresAt)}
                </p>
              </div>

              <div className="mb-6 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">{data.consentText}</pre>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => setShowConfirm("APPROVED")}
                >
                  Saya setuju
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowConfirm("REJECTED")}
                >
                  Saya menolak
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Modal
        open={showConfirm !== null}
        onClose={() => setShowConfirm(null)}
        title={showConfirm === "APPROVED" ? "Konfirmasi persetujuan" : "Konfirmasi penolakan"}
        description={
          showConfirm === "APPROVED"
            ? "Dengan memilih Setujui, Anda menyatakan telah membaca dan memahami isi persetujuan."
            : "Apakah Anda yakin ingin menolak persetujuan ini?"
        }
        size="sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(null)}>
            Batal
          </Button>
          <Button
            variant={showConfirm === "APPROVED" ? "primary" : "danger"}
            className="flex-1"
            loading={deciding}
            onClick={handleDecide}
          >
            {showConfirm === "APPROVED" ? "Setujui" : "Tolak consent"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
