"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  syncMasterData,
  syncPatients,
  syncQueues,
  useSyncedModules,
} from "@/lib/remote-sync";
import { encounterService } from "@/lib/services/encounter.service";
import { ApiError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/format";
import { toastSuccess, toastError } from "@/lib/use-toast";
import { Search, FileText, Lock, PenLine } from "lucide-react";

export default function MedicalRecordsPage() {
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const diagnoses = useStore((s) => s.diagnoses);
  const updateVisit = useStore((s) => s.updateVisit);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [addendumReason, setAddendumReason] = useState("");
  const [addendumNote, setAddendumNote] = useState("");
  const [savingAddendum, setSavingAddendum] = useState(false);
  const [icdQuery, setIcdQuery] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState<{ id: string; name: string } | null>(null);

  // Rekam medis — data pasien, kunjungan, dan katalog ICD-10 dari backend
  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncQueues();
    await syncMasterData();
  });

  const [search, setSearch] = useState("");
  const [selectedVisit, setSelectedVisit] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [soapData, setSoapData] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [diagnosisNote, setDiagnosisNote] = useState("");
  const [treatment, setTreatment] = useState("");
  const [doctorNote, setDoctorNote] = useState("");

  const filtered = visits.filter((v) => {
    const emp = employees.find((e) => e.id === v.employeeId);
    const q = search.toLowerCase();
    return !q || v.visitNumber.toLowerCase().includes(q) || emp?.fullName.toLowerCase().includes(q);
  });

  const visit = visits.find((v) => v.id === selectedVisit);
  const visitEmployee = visit ? employees.find((e) => e.id === visit.employeeId) : null;

  const openSOAP = (visitId: string) => {
    const v = visits.find((vis) => vis.id === visitId);
    if (!v) return;
    setSelectedVisit(visitId);
    setSaveMsg(null);
    setConflictMsg(null);
    setAddendumReason("");
    setAddendumNote("");
    setIcdQuery("");
    setSoapData({
      subjective: v.chiefComplaint || "",
      objective: v.initialExam || "",
      assessment: v.diagnosisNote || "",
      plan: v.treatment || "",
    });
    setSelectedDiagnoses(v.diagnosisIds || []);
    setDiagnosisNote(v.diagnosisNote || "");
    setTreatment(v.treatment || "");
    setDoctorNote(v.doctorNote || "");
    setShowModal(true);
  };

  const handleFinalize = async () => {
    if (!selectedVisit) return;
    const v = visit;
    setConfirmFinalize({ id: selectedVisit, name: v?.visitNumber ?? selectedVisit });
  };

  const handleConfirmFinalize = async () => {
    if (!confirmFinalize || !selectedVisit) return;
    setSaveMsg(null);
    setConflictMsg(null);
    setFinalizing(true);
    try {
      const res = await encounterService.finalize(selectedVisit);
      const nextStatus = String(res?.status ?? "").toUpperCase() === "LOCKED" ? "Locked" : "Completed";
      updateVisit(selectedVisit, { status: nextStatus });
      setConfirmFinalize(null);
      setShowModal(false);
      toastSuccess("Rekam medis difinalisasi", `Kunjungan ${confirmFinalize.name} telah dikunci dan tidak dapat diubah.`);
    } catch (e) {
      setConfirmFinalize(null);
      if (e instanceof ApiError && e.status === 409) {
        setConflictMsg("Data rekam medis telah berubah di backend. Muat ulang lalu coba lagi (409 Conflict).");
      } else {
        setSaveMsg(e instanceof Error ? e.message : "Gagal finalisasi rekam medis.");
        toastError("Gagal finalisasi", e instanceof Error ? e.message : undefined);
      }
    } finally {
      setFinalizing(false);
    }
  };

  const handleAddendum = async () => {
    if (!selectedVisit || !addendumReason.trim() || !addendumNote.trim()) return;
    setSaveMsg(null);
    setConflictMsg(null);
    setSavingAddendum(true);
    try {
      await encounterService.addendum(selectedVisit, addendumReason.trim(), addendumNote.trim());
      setSaveMsg("Addendum berhasil disimpan pada rekam medis yang terkunci.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflictMsg("Data rekam medis telah berubah di backend. Muat ulang lalu coba lagi (409 Conflict).");
      } else {
        setSaveMsg(e instanceof Error ? e.message : "Gagal menyimpan addendum.");
      }
    } finally {
      setSavingAddendum(false);
    }
  };

  const handleIcdSearch = async (keyword: string) => {
    setIcdQuery(keyword);
    if (keyword.trim().length < 2) return;
    try {
      const rows = await encounterService.searchIcd10(keyword.trim());
      const mapped = rows.map((r) => ({
        id: r.id ?? r.code,
        code: r.code,
        description: r.description ?? r.name ?? "",
        category: "",
      }));
      if (mapped.length > 0) {
        useStore.setState({ diagnoses: mapped });
      }
    } catch {
      // biarkan daftar ICD-10 lokal tetap tersedia
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rekam Medis</h1>
        <p className="text-sm text-slate-500">SOAP notes dan diagnosis ICD-10</p>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
          Gagal memuat data: {error}{" "}
          <button className="underline" onClick={refetch}>Coba lagi</button>
        </div>
      )}
      {saveMsg && (
        <div className="rounded-xl bg-warning-50 p-3 text-sm text-warning-700">{saveMsg}</div>
      )}
      {conflictMsg && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
          {conflictMsg}{" "}
          <button className="underline" onClick={refetch}>
            Muat ulang
          </button>
        </div>
      )}
      {loading && !error && (
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      )}

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nomor kunjungan, nama pasien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <p className="text-sm text-slate-500">{filtered.length} rekam medis</p>

      <div className="space-y-3">
        {filtered.map((v) => {
          const emp = employees.find((e) => e.id === v.employeeId);
          const visitDiagnoses = diagnoses.filter((d) => v.diagnosisIds?.includes(d.id));
          return (
            <Card key={v.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp?.fullName ?? "?"} />
                  <div>
                    <p className="font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {v.visitNumber} · {formatDate(v.date)} · {v.time}
                    </p>
                    <p className="text-xs text-slate-500">Keluhan: {v.chiefComplaint}</p>
                    {visitDiagnoses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visitDiagnoses.map((d) => (
                          <Badge key={d.id} variant="info">{d.code}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === "Completed" ? "success" : v.status === "Locked" ? "outline" : "warning"}>
                    {v.status}
                  </Badge>
                  <Can action="visits.edit-soap">
                    <Button size="sm" variant="outline" onClick={() => openSOAP(v.id)}>
                      {v.status === "Locked" ? <Lock className="size-3.5" /> : <FileText className="size-3.5" />}
                      {v.status === "Locked" ? "Addendum" : "SOAP"}
                    </Button>
                  </Can>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Rekam Medis SOAP"
        description={visit ? `${visit.visitNumber} — ${visitEmployee?.fullName}` : ""}
        size="lg"
      >
        <div className="space-y-4">
          {visit?.status === "Locked" ? (
            <>
              <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                <Lock className="inline size-4" /> Rekam medis ini sudah <strong>LOCKED</strong>. Perubahan ditambahkan melalui addendum.
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">Alasan Addendum</h3>
                <Input
                  value={addendumReason}
                  onChange={(e) => setAddendumReason(e.target.value)}
                  placeholder="Alasan perubahan setelah penguncian..."
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">Catatan Addendum</h3>
                <Input
                  value={addendumNote}
                  onChange={(e) => setAddendumNote(e.target.value)}
                  placeholder="Isi perubahan/addendum..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowModal(false)}>Tutup</Button>
                <Can action="visits.edit-soap">
                  <Button onClick={handleAddendum} loading={savingAddendum}>
                    <PenLine className="size-3.5" />
                    Simpan Addendum
                  </Button>
                </Can>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">S — Subjective</h3>
                <Input
                  value={soapData.subjective}
                  onChange={(e) => setSoapData((s) => ({ ...s, subjective: e.target.value }))}
                  placeholder="Keluhan utama..."
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">O — Objective</h3>
                <Input
                  value={soapData.objective}
                  onChange={(e) => setSoapData((s) => ({ ...s, objective: e.target.value }))}
                  placeholder="Hasil pemeriksaan fisik..."
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">A — Assessment</h3>
                <div className="space-y-2">
                  <Input
                    label="Cari ICD-10 (backend)"
                    value={icdQuery}
                    onChange={(e) => handleIcdSearch(e.target.value)}
                    placeholder="Ketik minimal 2 huruf..."
                  />
                  <Select
                    label="Diagnosis ICD-10"
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !selectedDiagnoses.includes(e.target.value)) {
                        setSelectedDiagnoses((prev) => [...prev, e.target.value]);
                      }
                    }}
                    placeholder="Pilih diagnosis..."
                    options={diagnoses.map((d) => ({ value: d.id, label: `${d.code} — ${d.description}` }))}
                  />
                  {selectedDiagnoses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedDiagnoses.map((id) => {
                        const d = diagnoses.find((diag) => diag.id === id);
                        return (
                          <Badge key={id} variant="info" className="cursor-pointer" onClick={() => setSelectedDiagnoses((prev) => prev.filter((x) => x !== id))}>
                            {d?.code} ✕
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <Input
                    value={diagnosisNote}
                    onChange={(e) => setDiagnosisNote(e.target.value)}
                    placeholder="Catatan diagnosis..."
                  />
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">P — Plan</h3>
                <Input
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  placeholder="Rencana pengobatan..."
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-700">Catatan Dokter</h3>
                <Input
                  value={doctorNote}
                  onChange={(e) => setDoctorNote(e.target.value)}
                  placeholder="Catatan tambahan..."
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
                <Can action="visits.edit-soap">
                  {confirmFinalize?.id === selectedVisit ? (
                    <div className="rounded-lg bg-warning-50 p-2 text-xs text-warning-700">
                      <p className="mb-1">Konfirmasi finalisasi kunjungan {confirmFinalize.name}?</p>
                      <p className="text-xs text-warning-600">Data akan dikunci dan tidak dapat diubah.</p>
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={handleFinalize}
                    loading={finalizing}
                    disabled={confirmFinalize?.id === selectedVisit && finalizing}
                  >
                    <Lock className="size-3.5" />
                    {confirmFinalize?.id === selectedVisit ? "Konfirmasi Finalize" : "Finalize & Lock"}
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirmFinalize?.id === selectedVisit) {
                        void handleConfirmFinalize();
                      } else {
                        handleFinalize();
                      }
                    }}
                    disabled={savingAddendum || finalizing}
                  >
                    {confirmFinalize?.id === selectedVisit ? "Ya, Finalize" : "Simpan SOAP"}
                  </Button>
                </Can>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
