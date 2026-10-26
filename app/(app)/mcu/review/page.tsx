"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  mapHealthToFtw,
  syncMcu,
  syncPatients,
  useSyncedModules,
} from "@/lib/remote-sync";
import { mcuService } from "@/lib/services/mcu.service";
import type { HealthStatus } from "@/lib/types";
import { MCU_STATUS, HEALTH_STATUS_OPTIONS } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { ErrorState } from "@/components/ui/error-state";
import { formatDate } from "@/lib/format";
import { toastSuccess, toastError } from "@/lib/use-toast";
import { Search, CheckCircle, XCircle, FileText } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

export default function MCUReviewPage() {
  const mcus = useStore((s) => s.mcus);
  const employees = useStore((s) => s.employees);
  const approveMCU = useStore((s) => s.approveMCU);
  const rejectMCU = useStore((s) => s.rejectMCU);
  const requestRevision = useStore((s) => s.requestRevision);

  // Modul 4 — sinkron data MCU & pekerja dari backend
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncMcu(1, 100);
  });

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject" | "revision";
    id: string;
    name: string;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedMCU, setSelectedMCU] = useState<string | null>(null);
  const [decision, setDecision] = useState<string>("");
  const [note, setNote] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [restriction, setRestriction] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"approve" | "reject" | "revision">("approve");

  const pendingMCUs = mcus.filter((m) => {
    const emp = employees.find((e) => e.id === m.employeeId);
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.mcuNumber.toLowerCase().includes(q) ||
      emp?.fullName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || m.status === statusFilter;
    return matchSearch && matchStatus && m.status !== "Approved" && m.status !== "Rejected";
  });

  const mcu = mcus.find((m) => m.id === selectedMCU);
  const mcuEmployee = mcu ? employees.find((e) => e.id === mcu.employeeId) : null;

  const openModal = (id: string, type: "approve" | "reject" | "revision") => {
    setSelectedMCU(id);
    setModalType(type);
    setDecision("");
    setNote("");
    setValidFrom("");
    setValidUntil("");
    setRestriction("");
    setRecommendation("");
    setReviewDate("");
    setShowModal(true);
  };

  const handleAction = () => {
    if (!selectedMCU || actionBusy) return;
    // Validasi input sebelum konfirmasi
    if (modalType === "approve") {
      if (!decision) {
        setActionError("Pilih keputusan kelaikan kerja terlebih dahulu.");
        return;
      }
      if (decision === "Fit with Restriction" && (!restriction || !reviewDate)) {
        setActionError("Restriksi dan tanggal review wajib diisi untuk keputusan Fit with Restriction.");
        return;
      }
    }
    const m = mcus.find((m) => m.id === selectedMCU);
    setConfirmAction({ type: modalType, id: selectedMCU, name: m?.mcuNumber ?? selectedMCU });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !selectedMCU) return;
    setActionBusy(true);
    setActionError("");
    try {
      if (confirmAction.type === "approve") {
        await mcuService.assessFtw(
          selectedMCU,
          mapHealthToFtw(decision),
          note || undefined,
          restriction && reviewDate
            ? { description: restriction, reviewDate }
            : undefined
        );
        approveMCU(selectedMCU, decision as HealthStatus, note, {
          validFrom,
          validUntil,
          restriction,
          recommendation,
          reviewDate,
        });
      } else if (confirmAction.type === "reject") {
        await mcuService.assessFtw(selectedMCU, "UNFIT", note || undefined);
        rejectMCU(selectedMCU, note);
      } else {
        requestRevision(selectedMCU, note);
      }
      await syncMcu(1, 100);
      setConfirmAction(null);
      setShowModal(false);
      toastSuccess(
        confirmAction.type === "approve"
          ? "MCU disetujui"
          : confirmAction.type === "reject"
            ? "MCU ditolak"
            : "Revisi MCU diminta",
        `Keputusan untuk MCU ${confirmAction.name} telah tersimpan.`
      );
    } catch (e) {
      setConfirmAction(null);
      setActionError(e instanceof Error ? e.message : "Gagal menyimpan keputusan.");
      toastError("Gagal menyimpan keputusan", e instanceof Error ? e.message : undefined);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Review MCU</h1>
        <p className="text-sm text-muted-foreground">Review dan tetapkan status kesehatan kerja</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nomor MCU, nama pekerja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(MCU_STATUS).map(([value, { label }]) => ({ value, label }))}
          />
        </div>
      </Card>

      <p className="text-sm text-muted-foreground">{pendingMCUs.length} MCU menunggu review</p>

      {error && <ErrorState title="Gagal memuat data MCU" message={error} onRetry={refetch} />}

      {loading && !error && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Memuat data MCU dari backend...</p>
        </Card>
      )}

      {!loading && !error && pendingMCUs.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="mx-auto mb-3 size-8 text-success-600" />
          <p className="text-sm text-muted-foreground">Tidak ada MCU yang menunggu review.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingMCUs.map((mcu) => {
            const emp = employees.find((e) => e.id === mcu.employeeId);
            const statusMeta = MCU_STATUS[mcu.status];
            return (
              <Card key={mcu.id} className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp?.fullName ?? "?"} />
                    <div>
                      <p className="font-medium text-foreground">{emp?.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {mcu.mcuNumber} · {mcu.type} · {formatDate(mcu.examDate)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge meta={statusMeta} />
                        {mcu.result && (
                          <span className="text-xs text-muted-foreground">
                            TD: {mcu.result.bloodPressure} · HR: {mcu.result.heartRate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openModal(mcu.id, "revision")}>
                      <FileText className="size-3.5" />
                      Revisi
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => openModal(mcu.id, "reject")}>
                      <XCircle className="size-3.5" />
                      Tolak
                    </Button>
                    <Can action="mcu.approve">
                      <Button size="sm" onClick={() => openModal(mcu.id, "approve")}>
                        <CheckCircle className="size-3.5" />
                        Approve
                      </Button>
                    </Can>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={modalType === "approve" ? "Approve MCU" : modalType === "reject" ? "Tolak MCU" : "Minta Revisi"}
        description={mcu ? `${mcu.mcuNumber} — ${mcuEmployee?.fullName}` : ""}
        size="lg"
      >
        <div className="space-y-4">
          {modalType === "approve" && (
            <>
              <Select
                label="Status Kesehatan Kerja"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="Pilih status"
                options={HEALTH_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Valid From" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                <Input label="Valid Until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <Input label="Restriction (opsional)" value={restriction} onChange={(e) => setRestriction(e.target.value)} placeholder="Deskripsi restriction" />
              <Input label="Recommendation (opsional)" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Rekomendasi" />
              <Input label="Review Date (opsional)" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </>
          )}
          <Input label="Catatan" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan review..." />
          {actionError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{actionError}</div>
          )}
          {confirmAction?.id === selectedMCU ? (
            <div className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">
              <p className="mb-1">
                Konfirmasi{" "}
                {confirmAction.type === "approve"
                  ? "persetujuan"
                  : confirmAction.type === "reject"
                    ? "penolakan"
                    : "permintaan revisi"}
                untuk MCU {confirmAction.name}?
              </p>
              <p className="text-xs text-warning-600">
                Keputusan akan dikirim ke backend dan tidak dapat diubah.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
            <Can action={modalType === "approve" ? "mcu.approve" : "mcu.review"}>
              <Button
                variant={modalType === "reject" ? "danger" : modalType === "revision" ? "outline" : "default"}
                onClick={() => {
                  if (confirmAction?.id === selectedMCU) {
                    void handleConfirmAction();
                  } else {
                    handleAction();
                  }
                }}
                loading={actionBusy}
                disabled={
                  actionBusy ||
                  (modalType === "approve" ? !decision : !note) ||
                  (confirmAction?.id === selectedMCU && actionBusy)
                }
              >
                {confirmAction?.id === selectedMCU ? "Ya, Simpan" : modalType === "approve" ? "Approve" : modalType === "reject" ? "Tolak" : "Minta Revisi"}
              </Button>
            </Can>
          </div>
        </div>
      </Modal>
    </div>
  );
}
