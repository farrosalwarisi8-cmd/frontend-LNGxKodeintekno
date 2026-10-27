"use client";

import { useState } from "react";
import { ShieldCheck, CircleCheck, AlertTriangle, XCircle, Clock3 } from "lucide-react";
import { patientService } from "@/lib/services/patient.service";
import { ApiError } from "@/lib/api-client";
import {
  CONSENT_DECISION_ACTIONS,
  resolveConsentFailurePhase,
  type ConsentDecision,
  type ConsentPhase,
} from "@/lib/consent-state";
import { CONSENT_TEXT } from "../fixtures/people.fixtures";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { PublicShell } from "@/components/public-shell";

/**
 * Halaman consent publik (tanpa login).
 *
 * PENTING — kontrak backend:
 * - `POST /public/consents/verify` adalah endpoint SATU-SATUNYA untuk token consent
 *   dan bersifat MUTASI + one-time: action selain `AGREED` menandai consent
 *   `REVOKED`. Karena itu halaman ini TIDAK boleh memanggil verify saat dimuat
 *   (memanggil dengan action "VIEW" akan menghabiskan/memutus token hanya dengan
 *   membuka halaman).
 * - Backend tidak menyediakan endpoint baca untuk memeriksa token, jadi status
 *   VALID/EXPIRED/USED hanya diketahui dari respons/error saat pekerja memutuskan.
 * - Tidak ada data pekerja yang boleh ditampilkan di sini (hanya teks consent),
 *   dan tidak ada tanggal/identitas yang boleh dikarang di frontend.
 */
type Phase = ConsentPhase;

export function PublicConsent({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState<ConsentDecision | null>(null);
  const [decision, setDecision] = useState<ConsentDecision | null>(null);

  const decide = async (value: ConsentDecision) => {
    setShowConfirm(null);
    setDecision(value);
    setPhase("deciding");
    setErrorMessage("");
    try {
      await patientService.verifyConsent(token, CONSENT_DECISION_ACTIONS[value]);
      setPhase("done");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Tidak dapat memproses permintaan.";
      // Token one-time: backend menolak token yang sudah diputus / tidak dikenal.
      setPhase(
        e instanceof ApiError
          ? resolveConsentFailurePhase(e.status, message)
          : resolveConsentFailurePhase(0, message)
      );
      setErrorMessage(message);
    }
  };

  if (phase === "done") {
    return (
      <PublicShell>
        <Card className="mx-auto w-full max-w-xl p-8 text-center">
          {decision === "REJECTED" ? (
            <XCircle className="mx-auto mb-4 size-12 text-danger" aria-hidden="true" />
          ) : (
            <CircleCheck className="mx-auto mb-4 size-12 text-success" aria-hidden="true" />
          )}
          <h1 className="text-xl font-semibold text-foreground">
            {decision === "REJECTED" ? "Penolakan berhasil dicatat" : "Persetujuan berhasil dicatat"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Terima kasih. Keputusan Anda sudah tersimpan dan tidak dapat diubah melalui tautan ini.
          </p>
        </Card>
      </PublicShell>
    );
  }

  if (phase === "used" || phase === "invalid") {
    const used = phase === "used";
    return (
      <PublicShell>
        <Card className="mx-auto w-full max-w-xl p-8 text-center" role="status" aria-live="polite">
          {used ? (
            <CircleCheck className="mx-auto mb-4 size-12 text-success" aria-hidden="true" />
          ) : (
            <XCircle className="mx-auto mb-4 size-12 text-danger" aria-hidden="true" />
          )}
          <h1 className="text-lg font-semibold text-foreground">
            {used ? "Tautan sudah digunakan" : "Tautan tidak valid atau kedaluwarsa"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {used
              ? "Consent ini sudah pernah diputus sebelumnya. Untuk mengubah keputusan, minta admin mengirim tautan baru."
              : "Tautan consent tidak dapat digunakan. Silakan minta tautan baru dari admin klinik."}
          </p>
          {errorMessage && <p className="mt-3 text-xs text-muted-foreground">{errorMessage}</p>}
        </Card>
      </PublicShell>
    );
  }

  if (phase === "error") {
    return (
      <PublicShell>
        <Card className="mx-auto w-full max-w-xl p-6 text-center" role="alert">
          <AlertTriangle className="mx-auto mb-4 size-12 text-danger" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">Gagal memproses permintaan</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMessage || "Terjadi kesalahan pada server."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setPhase("ready")}>
            Coba lagi
          </Button>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Card className="mx-auto w-full max-w-xl overflow-hidden">
        <div className="p-6">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold text-foreground">
              Persetujuan Pemrosesan Data Rekam Medis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Baca isi persetujuan berikut, lalu pilih keputusan Anda.
            </p>
          </div>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary-50 p-3 text-primary-700">
            <ShieldCheck className="size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Tautan persetujuan Anda</p>
              <p className="text-xs opacity-80">
                Baca isi persetujuan berikut, lalu pilih keputusan Anda.
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-50 p-3 text-xs text-warning-700">
            <Clock3 className="size-4 shrink-0" />
            <span>
              Tautan hanya dapat dipakai satu kali. Keputusan yang sudah dikirim tidak dapat diubah dari
              halaman ini.
            </span>
          </div>

          <div className="mb-6 max-h-64 overflow-y-auto rounded-xl border border-border bg-muted p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-text-secondary">{CONSENT_TEXT}</pre>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="default"
              className="flex-1"
              loading={phase === "deciding"}
              disabled={phase === "deciding" || !token}
              onClick={() => setShowConfirm("APPROVED")}
            >
              Saya setuju
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={phase === "deciding" || !token}
              onClick={() => setShowConfirm("REJECTED")}
            >
              Saya menolak
            </Button>
          </div>

          {!token && (
            <p className="mt-3 text-sm text-danger-600" role="alert">
              Tautan consent tidak berisi token. Silakan gunakan tautan lengkap dari email Anda.
            </p>
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
            variant={showConfirm === "APPROVED" ? "default" : "danger"}
            className="flex-1"
            onClick={() => showConfirm && decide(showConfirm)}
          >
            {showConfirm === "APPROVED" ? "Setujui" : "Tolak consent"}
          </Button>
        </div>
      </Modal>
    </PublicShell>
  );
}
