"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mcuService } from "@/lib/services/mcu.service";
import { useCan } from "@/components/can";
import {
  ACKNOWLEDGEMENT_TYPE_OPTIONS,
  INITIAL_ACK_SESSION,
  ackButtonLabel,
  acknowledgeReducer,
  ackPersistenceNote,
  canSubmitAck,
  extractRestrictions,
  formatAckTimestamp,
  type AckSessionState,
  type AcknowledgementType,
  type RestrictionItem,
} from "@/lib/hse-acknowledgement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { ShieldCheck, AlertTriangle, ClipboardCheck } from "lucide-react";

/**
 * Bagian "Restriksi Kerja — Acknowledgement HSE".
 *
 * Aturan yang dipatuhi (F2-A):
 *  - CTA hanya tampil bila role memiliki permission `acknowledge-restriction`.
 *  - Tidak ada request saat halaman hanya dibuka untuk membaca status
 *    acknowledgement (tidak ada endpoint bacanya) — yang diambil hanya daftar
 *    MCU + restriksi (`GET /mcu/cycles`), bukan mutasi.
 *  - Status `acknowledged` HANYA setelah response API sukses.
 *  - Keterbatasan persistence ditampilkan jujur (tidak ada fake persistence).
 *  - Double-click aman: state `submitting` menonaktifkan tombol + guard in-flight.
 */
export function RestrictionAcknowledgementSection() {
  const can = useCan();
  const permitted = can("mcu.acknowledge-restriction");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<RestrictionItem[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<RestrictionItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ackType, setAckType] = useState<AcknowledgementType>("HSE");
  const [note, setNote] = useState("");
  const [sessions, setSessions] = useState<Record<string, AckSessionState>>({});
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!permitted) return;
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      mcuService
        .list({ page: 1, limit: 100 })
        .then((res) => {
          if (!alive) return;
          setRestrictions(extractRestrictions(res.data ?? []));
          setLoadError(null);
        })
        .catch((e: unknown) => {
          if (alive) setLoadError(e instanceof Error ? e.message : "Gagal memuat restriksi kerja.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [permitted, reloadKey]);

  const sessionFor = useCallback(
    (id: string): AckSessionState => sessions[id] ?? INITIAL_ACK_SESSION,
    [sessions]
  );

  const openConfirm = (item: RestrictionItem) => {
    setSelected(item);
    setAckType("HSE");
    setNote("");
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const id = selected.id;
    // Anti double-submit: cek state + guard in-flight (ref) sebelum request.
    const current = sessions[id] ?? INITIAL_ACK_SESSION;
    if (!canSubmitAck(current.state) || inFlight.current.has(id)) return;

    inFlight.current.add(id);
    setSessions((s) => ({ ...s, [id]: acknowledgeReducer(s[id] ?? INITIAL_ACK_SESSION, { type: "submit" }) }));
    try {
      const res = await mcuService.acknowledgeRestriction(id, ackType, note.trim() || undefined);
      // Status acknowledged HANYA dari response sukses API.
      setSessions((s) => ({
        ...s,
        [id]: acknowledgeReducer(s[id] ?? INITIAL_ACK_SESSION, {
          type: "success",
          acknowledgementId: res?.id ?? null,
          acknowledgedAt: res?.acknowledged_at ?? null,
        }),
      }));
    } catch (e) {
      setSessions((s) => ({
        ...s,
        [id]: acknowledgeReducer(s[id] ?? INITIAL_ACK_SESSION, {
          type: "failure",
          message: e instanceof Error ? e.message : "Acknowledgement gagal dikirim.",
        }),
      }));
    } finally {
      inFlight.current.delete(id);
      // Dialog selalu ditutup (sukses maupun gagal) supaya daftar tetap dapat
      // dioperasikan dan tombol "Coba kirim ulang" pada baris tidak terhalang.
      setConfirmOpen(false);
      setSelected(null);
    }
  };

  const pendingCount = useMemo(
    () => restrictions.filter((r) => sessionFor(r.id).state === "not-acknowledged").length,
    [restrictions, sessionFor]
  );

  if (!permitted) return null;

  return (
    <Card data-testid="hse-restriction-acknowledgement">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary-600" />
          Restriksi Kerja — Acknowledgement HSE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-500">
          Konfirmasi penerimaan restriksi kerja pekerja. {pendingCount > 0
            ? `${pendingCount} restriksi belum di-acknowledge.`
            : "Semua restriksi pada sesi ini sudah ditangani."}
        </p>

        {loadError && (
          <ErrorState
            title="Gagal memuat restriksi kerja"
            message={loadError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        )}

        {loading && !loadError && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!loading && !loadError && restrictions.length === 0 && (
          <EmptyState
            icon={ClipboardCheck}
            title="Tidak ada restriksi kerja aktif"
            description="Restriksi akan muncul di sini setelah Dokter OH menetapkan FTW dengan restriksi."
          />
        )}

        {!loading && !loadError && restrictions.length > 0 && (
          <ul className="space-y-2">
            {restrictions.map((item) => {
              const session = sessionFor(item.id);
              const acknowledged = session.state === "acknowledged";
              const ackTime = formatAckTimestamp(session.acknowledgedAt);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-3"
                  data-testid={`restriction-${item.id}`}
                  data-ack-state={session.state}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-500">
                        {item.patientName ?? "Pekerja"}{item.employeeNo ? ` · ${item.employeeNo}` : ""}
                        {item.ftwStatus ? ` · FTW: ${item.ftwStatus}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {item.status && <Badge variant="outline">{item.status}</Badge>}
                        {item.reviewDate && (
                          <span className="text-xs text-slate-500">
                            Review: {formatDate(item.reviewDate)}
                          </span>
                        )}
                        {acknowledged && (
                          <Badge variant="success" data-testid="ack-status">
                            Acknowledged{ackTime ? ` · ${ackTime}` : ""}
                          </Badge>
                        )}
                        {session.state === "failed" && (
                          <Badge variant="danger" data-testid="ack-status">
                            Gagal
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <Button
                        size="sm"
                        variant={acknowledged ? "outline" : "default"}
                        onClick={() => openConfirm(item)}
                        disabled={session.state === "submitting" || acknowledged}
                        loading={session.state === "submitting"}
                        data-testid="ack-button"
                      >
                        <ShieldCheck className="size-3.5" />
                        {ackButtonLabel(session.state)}
                      </Button>
                    </div>
                  </div>

                  {session.error && (
                    <div className="mt-2 flex items-start gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>{session.error} Silakan coba kirim ulang.</span>
                    </div>
                  )}

                  {acknowledged && ackPersistenceNote(false) && (
                    <p
                      className="mt-2 rounded-xl bg-warning-50 p-3 text-xs text-warning-700"
                      data-testid="ack-persistence-note"
                    >
                      {ackPersistenceNote(false)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Konfirmasi acknowledgement restriksi"
        description={selected?.description ?? ""}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Saya mengonfirmasi telah menerima dan menindaklanjuti restriksi kerja
            {selected?.patientName ? ` untuk ${selected.patientName}` : ""}. Tindakan ini tercatat
            di server.
          </p>
          <Select
            label="Dikonfirmasi oleh"
            value={ackType}
            onChange={(e) => setAckType(e.target.value as AcknowledgementType)}
            options={ACKNOWLEDGEMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Input
            label="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tindak lanjut yang sudah dilakukan..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              loading={selected ? sessionFor(selected.id).state === "submitting" : false}
              disabled={selected ? !canSubmitAck(sessionFor(selected.id).state) : true}
              data-testid="ack-confirm"
            >
              Kirim acknowledgement
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
