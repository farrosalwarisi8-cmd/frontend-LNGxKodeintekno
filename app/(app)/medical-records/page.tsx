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
import { patientService, type BackendClinicalEncounter } from "@/lib/services/patient.service";
import type { ClinicVisit } from "@/lib/types";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { Search, FileText, Lock } from "lucide-react";

export default function MedicalRecordsPage() {
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const diagnoses = useStore((s) => s.diagnoses);
  const updateVisit = useStore((s) => s.updateVisit);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  // Fase 3 — status transaksi SOAP/finalize di lapisan form (di dalam modal)
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const openSOAP = async (visitId: string) => {
    const v = visits.find((vis) => vis.id === visitId);
    if (!v) return;
    // Muat jejak encounter backend (id + status LOCKED) sebelum form dibuka,
    // supaya record terkunci langsung tampil read-only.
    try {
      await resolveEncounter(v, false);
    } catch {
      /* tidak fatal — form tetap dibuka dengan state lokal */
    }
    setSelectedVisit(visitId);
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
    setFormError(null);
    setShowModal(true);
  };

  const selectedVisitRecord = visits.find((v) => v.id === selectedVisit);
  const isLocked = selectedVisitRecord?.recordStatus === "LOCKED";

  const applyEncounter = (
    visitId: string,
    enc: { id: string; status?: string; locked_at?: string | null }
  ) => {
    updateVisit(visitId, {
      encounterId: enc.id,
      recordStatus: String(enc.status ?? "").toUpperCase() === "LOCKED" ? "LOCKED" : "DRAFT",
      lockedAt: enc.locked_at ?? undefined,
    });
  };

  /**
   * Fase 3 — Queue → Visit: kunjungan dari antrean hanya punya ticket id,
   * bukan encounter id. Encounter yang SUDAH ADA untuk appointment dipakai
   * ulang; baru dibuat bila benar-benar belum ada.
   *
   * Pencarian wajib karena backend memberlakukan unique constraint pada
   * `appointment_id` — create membabi-buta akan ditolak dan SOAP gagal tersimpan.
   * Jalur baca satu-satunya: GET /patients/:id/profile → clinical_encounters.
   */
  const resolveEncounter = async (v: ClinicVisit, create: boolean): Promise<string | null> => {
    if (v.encounterId) return v.encounterId;
    if (!v.employeeId) {
      if (!create) return null;
      throw new Error("Kunjungan tidak memiliki pasien terkait — encounter tidak dapat dibuka.");
    }

    if (v.appointmentId) {
      try {
        const existing = (await patientService.getClinicalEncounters(v.employeeId)).find(
          (e) => e.appointment_id === v.appointmentId
        );
        if (existing) {
          applyEncounter(v.id, existing);
          return existing.id;
        }
      } catch {
        /* bukan user medis / gagal baca — lanjut ke pembuatan */
      }
    }

    if (!create) return null;
    const enc = await encounterService.openEncounter(v.employeeId, v.appointmentId || undefined);
    applyEncounter(v.id, enc);
    return enc.id;
  };

  const soapPayload = () => ({
    subjective: soapData.subjective || undefined,
    objective: soapData.objective || undefined,
    assessment: diagnosisNote || undefined,
    plan: treatment || undefined,
    primaryIcd10: diagnoses.find((d) => d.id === selectedDiagnoses[0])?.code,
  });

  /** PUT /clinic/encounters/:id/soap — melempar bila backend menolak (mis. LOCKED). */
  const persistSoap = async (v: ClinicVisit): Promise<string> => {
    const encounterId = await resolveEncounter(v, true);
    if (!encounterId) {
      throw new Error("Encounter kunjungan tidak ditemukan — SOAP tidak dapat disimpan.");
    }
    await encounterService.saveSoap(encounterId, soapPayload());
    return encounterId;
  };

  const localSoapPatch = (): Partial<ClinicVisit> => ({
    chiefComplaint: soapData.subjective,
    initialExam: soapData.objective,
    diagnosisIds: selectedDiagnoses,
    diagnosisNote,
    treatment,
    doctorNote,
    status: "Completed",
  });

  const handleSaveSOAP = async () => {
    if (!selectedVisit) return;
    const v = visits.find((vis) => vis.id === selectedVisit);
    if (!v) return;

    // Guard lapisan UI: record terkunci tidak bisa disimpan ulang sembarangan.
    if (v.recordStatus === "LOCKED") {
      setFormError(
        "Rekam medis terkunci (LOCKED) — tidak dapat diedit. Koreksi formal hanya melalui Addendum."
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const encounterId = await persistSoap(v);
      updateVisit(v.id, localSoapPatch());
      setSaveMsg(`SOAP tersimpan di backend — encounter ${encounterId}.`);
      setShowModal(false);
    } catch (e) {
      // Gagal = state lokal TIDAK diubah dan modal tetap terbuka (tanpa fake success).
      setFormError(e instanceof Error ? e.message : "SOAP tidak tersimpan di backend.");
    } finally {
      setSaving(false);
    }
  };

  /** Finalize → backend mengunci record (LOCKED). SOAP disimpan dulu. */
  const handleFinalize = async () => {
    if (!selectedVisit) return;
    const v = visits.find((vis) => vis.id === selectedVisit);
    if (!v || v.recordStatus === "LOCKED") return;

    setLocking(true);
    setFormError(null);
    try {
      const encounterId = await persistSoap(v);
      const locked = await encounterService.finalize(encounterId);
      const recordStatus: NonNullable<ClinicVisit["recordStatus"]> =
        String(locked?.status ?? "LOCKED").toUpperCase() === "LOCKED" ? "LOCKED" : "DRAFT";
      updateVisit(v.id, {
        ...localSoapPatch(),
        recordStatus,
        lockedAt: locked?.locked_at ?? new Date().toISOString(),
      });
      setSaveMsg(
        recordStatus === "LOCKED"
          ? `Rekam medis dikunci permanen (LOCKED) — encounter ${encounterId}. Perubahan lanjutan wajib lewat Addendum.`
          : `Backend tidak mengunci rekam medis (status ${locked?.status ?? "unknown"}).`
      );
      if (recordStatus === "LOCKED") setShowModal(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Finalize gagal — record tidak dikunci.");
    } finally {
      setLocking(false);
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
        <div className="rounded-xl bg-success-50 p-3 text-sm text-success-700">{saveMsg}</div>
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
                  {v.recordStatus === "LOCKED" ? (
                    <Badge variant="success">
                      <Lock className="size-3" />
                      Terkunci
                    </Badge>
                  ) : (
                    <Badge variant={v.status === "Completed" ? "success" : "warning"}>
                      {v.status}
                    </Badge>
                  )}
                  <Can action="visits.edit-soap">
                    <Button size="sm" variant="outline" onClick={() => openSOAP(v.id)}>
                      {v.recordStatus === "LOCKED" ? (
                        <>
                          <Lock className="size-3.5" />
                          Lihat
                        </>
                      ) : (
                        <>
                          <FileText className="size-3.5" />
                          SOAP
                        </>
                      )}
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
          {/* Fase 3 — record terkunci hanya bisa dibaca, tidak bisa diedit. */}
          {isLocked && (
            <div className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium text-slate-800">Rekam medis terkunci (LOCKED)</p>
                <p className="text-xs">
                  Record final tidak dapat diedit. Koreksi hanya melalui Addendum formal.
                </p>
              </div>
            </div>
          )}
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">S — Subjective</h3>
            <Input
              value={soapData.subjective}
              onChange={(e) => setSoapData((s) => ({ ...s, subjective: e.target.value }))}
              placeholder="Keluhan utama..."
              disabled={isLocked}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">O — Objective</h3>
            <Input
              value={soapData.objective}
              onChange={(e) => setSoapData((s) => ({ ...s, objective: e.target.value }))}
              placeholder="Hasil pemeriksaan fisik..."
              disabled={isLocked}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">A — Assessment</h3>
            <div className="space-y-2">
              <Select
                label="Diagnosis ICD-10"
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedDiagnoses.includes(e.target.value)) {
                    setSelectedDiagnoses((prev) => [...prev, e.target.value]);
                  }
                }}
                placeholder="Pilih diagnosis..."
                disabled={isLocked}
                options={diagnoses.map((d) => ({ value: d.id, label: `${d.code} — ${d.description}` }))}
              />
              {selectedDiagnoses.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDiagnoses.map((id) => {
                    const d = diagnoses.find((diag) => diag.id === id);
                    return (
                      <Badge
                        key={id}
                        variant="info"
                        className={isLocked ? "" : "cursor-pointer"}
                        onClick={
                          isLocked
                            ? undefined
                            : () => setSelectedDiagnoses((prev) => prev.filter((x) => x !== id))
                        }
                      >
                        {d?.code}
                        {!isLocked && " ✕"}
                      </Badge>
                    );
                  })}
                </div>
              )}
              <Input
                value={diagnosisNote}
                onChange={(e) => setDiagnosisNote(e.target.value)}
                placeholder="Catatan diagnosis..."
                disabled={isLocked}
              />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">P — Plan</h3>
            <Input
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="Rencana pengobatan..."
              disabled={isLocked}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">Catatan Dokter</h3>
            <Input
              value={doctorNote}
              onChange={(e) => setDoctorNote(e.target.value)}
              placeholder="Catatan tambahan..."
              disabled={isLocked}
            />
          </div>

          {formError && (
            <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{formError}</div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)} disabled={saving || locking}>
              {isLocked ? "Tutup" : "Batal"}
            </Button>
            {!isLocked && (
              <Can action="visits.edit-soap">
                <Button
                  variant="outline"
                  onClick={handleFinalize}
                  loading={locking}
                  disabled={saving || locking}
                >
                  <Lock className="size-4" />
                  Finalize & Kunci
                </Button>
              </Can>
            )}
            {!isLocked && (
              <Can action="visits.edit-soap">
                <Button onClick={handleSaveSOAP} loading={saving} disabled={saving || locking}>
                  Simpan SOAP
                </Button>
              </Can>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
