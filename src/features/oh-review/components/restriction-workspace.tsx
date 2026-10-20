"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Modal } from "@/shared/components/design-system/modal";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { useCan } from "@/components/can";
import { formatDate } from "@/lib/format";
import { toastSuccess } from "@/lib/use-toast";
import { closeRestriction, fetchReviewCycles } from "@/features/oh-review/api";
import { toReviewCycles, type ReviewCycle, type ReviewRestriction } from "@/features/oh-review/review-cycle";
import { Textarea } from "@/features/oh-review/components/textarea";
import { Info, ShieldCheck } from "lucide-react";

interface RestrictionRow extends ReviewRestriction {
  cycleId: string;
  mcuNumber: string;
  patientName: string;
  employeeNo: string;
  ftwStatus: string | null;
  active: boolean;
}

/**
 * A3 — Management restriksi kerja (Dokter OH).
 *
 * Hanya Dokter OH yang boleh menambah, mengubah, atau mengakhiri restriksi.
 * Role lain (HR, HSE, manajemen) tidak memiliki route maupun aksi ini — mereka
 * hanya melihat status ringkas di halaman Status Kesehatan (tidak diubah A3).
 */
export function RestrictionWorkspace() {
  const can = useCan();
  const permitted = can("mcu.manage-restriction");

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<RestrictionRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchReviewCycles({ page: 1, limit: 100 });
      setCycles(toReviewCycles(page.cycles));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data restriksi kerja.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const rows = useMemo<RestrictionRow[]>(
    () =>
      cycles.flatMap((cycle) =>
        cycle.restrictions.map((restriction) => ({
          ...restriction,
          cycleId: cycle.id,
          mcuNumber: cycle.mcuNumber,
          patientName: cycle.patientName,
          employeeNo: cycle.employeeNo,
          ftwStatus: cycle.ftwStatus,
          active: !["CLOSED", "RESOLVED", "LIFTED", "ENDED"].includes(
            (restriction.status ?? "").toUpperCase()
          ),
        }))
      ),
    [cycles]
  );

  const activeRows = rows.filter((row) => row.active);
  const closedRows = rows.filter((row) => !row.active);
  const visibleRows = showClosed ? rows : activeRows;

  const handleClose = async () => {
    if (!selected) return;
    if (!reason.trim()) {
      setFormError("Alasan pengakhiran restriksi wajib diisi.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await closeRestriction(selected.id);
      toastSuccess("Restriksi diakhiri", "Perubahan tercatat di server.");
      setSelected(null);
      setReason("");
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal mengakhiri restriksi.");
    } finally {
      setBusy(false);
    }
  };

  if (!permitted) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-slate-600">
            Management restriksi kerja hanya dapat dilakukan oleh Dokter OH.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary-600" />
            Restriksi kerja aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-500">
            Notifikasi ke HSE dibuat otomatis di server saat restriksi ditetapkan. Frontend tidak
            mengirim notifikasi sendiri, dan backend belum menyediakan status notifikasi yang
            dapat dibaca di sini (BLOCKER BACKEND).
          </p>

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {!loading && error && (
            <ErrorState
              title="Gagal memuat restriksi kerja"
              message={error}
              onRetry={() => setReloadKey((k) => k + 1)}
            />
          )}

          {!loading && !error && visibleRows.length === 0 && (
            <EmptyState
              icon={ShieldCheck}
              title="Tidak ada restriksi kerja"
              description="Restriksi muncul di sini setelah Dokter OH menetapkan FTW dengan pembatasan."
            />
          )}

          {!loading && !error && visibleRows.length > 0 && (
            <ul className="space-y-2">
              {visibleRows.map((row) => (
                <li
                  key={row.id}
                  data-testid={`restriction-row-${row.id}`}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{row.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.patientName} · {row.employeeNo || "NIP belum tersedia"} · {row.mcuNumber}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {row.effectiveDate ? <span>Mulai {formatDate(row.effectiveDate)}</span> : null}
                        {row.reviewDate ? <span>Review {formatDate(row.reviewDate)}</span> : null}
                        {row.supervisor ? <span>Supervisor: {row.supervisor}</span> : null}
                        {row.controls ? <span>Kontrol: {row.controls}</span> : null}
                        <Badge variant={row.active ? "warning" : "outline"}>
                          {row.status ?? (row.active ? "Aktif" : "Ditutup")}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSelected(row);
                          setReason("");
                          setFormError(null);
                        }}
                        disabled={!row.active}
                        data-testid={`close-restriction-${row.id}`}
                      >
                        Akhiri
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled
                        title="Backend belum menyediakan endpoint ubah restriksi (BLOCKER BACKEND)."
                        data-testid={`edit-restriction-${row.id}`}
                      >
                        Ubah
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled
                        title="Backend belum menyediakan endpoint hapus restriksi (BLOCKER BACKEND)."
                        data-testid={`delete-restriction-${row.id}`}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
                className="size-4 rounded border-slate-300"
              />
              Tampilkan riwayat restriksi yang sudah ditutup
            </label>
            <p className="text-xs text-slate-500">
              Aktif: {activeRows.length} · Ditutup: {closedRows.length}
            </p>
          </div>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Restriksi baru dibuat bersamaan dengan penetapan FTW “Fit with Restriction” pada
              halaman Review MCU. Backend belum menyediakan endpoint tambah/ubah/hapus restriksi
              mandiri (BLOCKER BACKEND).
            </span>
          </p>
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Akhiri restriksi kerja"
        description={selected?.description ?? ""}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Pengakhiran restriksi dicatat di server dan hanya dapat dilakukan oleh Dokter OH.
          </p>
          <Textarea
            label="Alasan pengakhiran (wajib)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            helper="Endpoint pengakhiran restriksi (POST /mcu/restrictions/:id/close) tidak memiliki parameter catatan, jadi alasan ini belum tersimpan di server (BLOCKER BACKEND)."
          />
          {formError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{formError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleClose} loading={busy} data-testid="confirm-close-restriction">
              Ya, akhiri restriksi
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
