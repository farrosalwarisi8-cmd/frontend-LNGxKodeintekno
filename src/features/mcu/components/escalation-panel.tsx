"use client";

import { useState } from "react";
import { Can } from "@/components/can";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { notificationService } from "@/lib/services/notification.service";
import { toastError, toastSuccess } from "@/lib/use-toast";

/**
 * Panel eksekusi mesin eskalasi reminder MCU (A1 — Tugas 2).
 *
 * Memakai endpoint backend yang SUDAH ADA: `POST /admin/escalation/run-check`.
 * Tidak ada request otomatis saat halaman dibuka (hanya saat tombol ditekan),
 * sehingga halaman ini tetap aman dibuka (read-only).
 *
 * Action `escalation.run` -> permission `manage-hse`. Role tanpa izin
 * melihat tombol NONAKTIF beserta alasannya (bukan disembunyikan tanpa
 * penjelasan).
 */

type RunState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; evaluated?: number; escalated?: number }
  | { status: "error"; message: string };

export function EscalationPanel() {
  const [state, setState] = useState<RunState>({ status: "idle" });

  const runCheck = async () => {
    setState({ status: "loading" });
    try {
      const res = await notificationService.runEscalationCheck();
      setState({
        status: "success",
        evaluated: res?.evaluatedCount,
        escalated: res?.escalatedCount,
      });
      toastSuccess(
        "Pemeriksaan eskalasi selesai",
        `${res?.evaluatedCount ?? 0} record dievaluasi, ${res?.escalatedCount ?? 0} Needs escalation.`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal menjalankan pemeriksaan eskalasi.";
      setState({ status: "error", message });
      toastError("Gagal menjalankan eskalasi", message);
    }
  };

  const disabledReason = "Memerlukan izin HSE untuk menjalankan mesin eskalasi.";

  return (
    <Card data-testid="escalation-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary-600" />
          Eskalasi Reminder MCU
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          Menjalankan pemeriksaan backend untuk tahap H-30, H-14, H-7, hari-H, dan status
          overdue. Eskalasi berjenjang mengikuti konfigurasi yang disimpan di backend.
        </p>

        <Can
          action="escalation.run"
          fallback={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled title={disabledReason} data-testid="escalation-run">
                <RefreshCw className="size-4" />
                Jalankan pemeriksaan eskalasi
              </Button>
              <span className="text-xs text-slate-500">{disabledReason}</span>
            </div>
          }
        >
          <Button
            variant="outline"
            onClick={() => void runCheck()}
            loading={state.status === "loading"}
            disabled={state.status === "loading"}
            data-testid="escalation-run"
          >
            <RefreshCw className="size-4" />
            Jalankan pemeriksaan eskalasi
          </Button>
        </Can>

        {state.status === "loading" && (
          <p className="text-sm text-slate-500" role="status" data-testid="escalation-loading">
            Menjalankan pemeriksaan eskalasi...
          </p>
        )}

        {state.status === "success" && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl bg-success-50 p-3 text-sm text-success-700"
            role="status"
            data-testid="escalation-success"
          >
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>Pemeriksaan selesai.</span>
            <Badge variant="success">Dievaluasi: {state.evaluated ?? 0}</Badge>
            <Badge variant={state.escalated ? "warning" : "success"}>
              Needs escalation: {state.escalated ?? 0}
            </Badge>
          </div>
        )}

        {state.status === "error" && (
          <div
            className="flex items-start gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700"
            role="alert"
            data-testid="escalation-error"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>{state.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
