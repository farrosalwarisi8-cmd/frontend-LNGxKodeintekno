"use client";

import { Can } from "@/components/can";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { encounterService } from "@/lib/services/encounter.service";
import type { ClinicVisit } from "@/lib/types";
import {
  VITAL_SPECS,
  assessVitals,
  vitalFieldError,
  vitalWarningCount,
} from "@/shared/validation/vital-signs";
import { Card } from "@/shared/components/design-system/card";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { UserRound, MapPin, FileText, ChevronLeft, ChevronRight, Check, HeartPulse, Stethoscope } from "lucide-react";

const STEPS = [
  { id: 1, label: "Pasien", icon: UserRound },
  { id: 2, label: "Lokasi", icon: MapPin },
  { id: 3, label: "Keluhan", icon: FileText },
  { id: 4, label: "Vital Sign", icon: HeartPulse },
  { id: 5, label: "Review", icon: Stethoscope },
];

export default function VisitNewPage() {
  const router = useRouter();
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);
  // Daftar pasien dari backend (Modul 2) dibutuhkan untuk memilih pasien
  const { loading: loadingPatients, error: patientsError, refetch } = useSyncedModules(() =>
    syncPatients(1, 100)
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [initialExam, setInitialExam] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const selectedLocation = locations.find((l) => l.id === locationId);

  // Validasi rentang TTV — dipakai untuk menandai salah ketik sebelum disimpan.
  const vitals = assessVitals(
    {
      systolicBp: systolic,
      diastolicBp: diastolic,
      pulse: heartRate,
      temperature,
      weightKg: weight,
      heightCm: height,
    },
    ["systolicBp", "diastolicBp", "pulse", "weightKg", "heightCm"]
  );

  const canProceed = () => {
    if (currentStep === 1) return !!employeeId;
    if (currentStep === 2) return !!locationId;
    if (currentStep === 3) return !!chiefComplaint;
    // Langkah TTV: wajib terisi DAN semua nilai dalam rentang wajar.
    if (currentStep === 4) return vitals.canProceed;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      // Buka kunjungan klinis di backend: POST /api/v1/clinic/encounters
      const encounter = await encounterService.openEncounter(employeeId);

      // Catat TTV: PUT /api/v1/clinic/encounters/:id/vitals (BMI dihitung backend)
      await encounterService.recordVitals(encounter.id, {
        heightCm: Number(height),
        weightKg: Number(weight),
        systolicBp: Number(systolic),
        diastolicBp: Number(diastolic),
        pulse: Number(heartRate),
        temperature: temperature ? Number(temperature) : undefined,
      });

      // Simpan draf SOAP (keluhan = subjective, pemeriksaan awal = objective)
      await encounterService.saveSoap(encounter.id, {
        subjective: chiefComplaint,
        objective: initialExam || undefined,
      });

      const visit: ClinicVisit = {
        id: encounter.id,
        // Fase 3 — jejak backend: id encounter dipakai ulang oleh halaman
        // Rekam Medis untuk simpan SOAP & finalize tanpa membuka encounter baru.
        encounterId: encounter.id,
        recordStatus: "DRAFT",
        visitNumber: `ENC-${encounter.id.slice(0, 8).toUpperCase()}`,
        queueNumber: useStore.getState().visits.length + 1,
        employeeId,
        locationId,
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        chiefComplaint,
        initialExam,
        diagnosisIds: [],
        diagnosisNote: "",
        treatment: "",
        doctorNote: "",
        status: "Registered",
        createdAt: new Date().toISOString(),
      };
      useStore.setState((s) => ({ visits: [visit, ...s.visits] }));

      router.push("/visits");
    } catch (e) {
      setSubmitting(false);
      setSubmitError(
        e instanceof Error ? e.message : "Gagal menyimpan kunjungan ke backend."
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Kunjungan Baru</h1>
        <p className="text-sm text-muted-foreground">Registrasi kunjungan klinik</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isActive = currentStep === s.id;
          const isCompleted = currentStep > s.id;
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "border-primary-600 bg-primary-600 text-primary-foreground"
                      : isActive
                        ? "border-primary-600 bg-card text-primary-600"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span className={`mt-1 text-xs font-medium ${isActive ? "text-primary-600" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 ${currentStep > s.id ? "bg-primary-600" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Pilih Pasien</h2>
            <Select
              label="Pasien"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder={loadingPatients ? "Memuat pasien..." : "Pilih pasien"}
              options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeId})` }))}
            />
            {patientsError && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                Gagal memuat daftar pasien: {patientsError}{" "}
                <button className="underline" onClick={refetch}>
                  Coba lagi
                </button>
              </div>
            )}
            {!loadingPatients && !patientsError && employees.length === 0 && (
              <div className="rounded-xl bg-warning-50 p-3 text-sm text-warning-700">
                Belum ada pasien terdaftar. Daftarkan pekerja melalui menu People terlebih dahulu.
              </div>
            )}
            {selectedEmployee && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted p-4">
                <Avatar name={selectedEmployee.fullName} />
                <div>
                  <p className="font-medium text-foreground">{selectedEmployee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployee.employeeId} · {selectedEmployee.mrn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployee.jobTitle} · {selectedEmployee.status}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Lokasi Klinik</h2>
            <Select
              label="Lokasi"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Pilih lokasi"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
            {selectedLocation && (
              <div className="rounded-xl border border-border bg-muted p-4">
                <p className="font-medium text-foreground">{selectedLocation.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{selectedLocation.type}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Keluhan Utama</h2>
            <Input
              label="Keluhan Utama"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Tuliskan keluhan utama pasien..."
            />
            <Input
              label="Pemeriksaan Awal"
              value={initialExam}
              onChange={(e) => setInitialExam(e.target.value)}
              placeholder="Hasil pemeriksaan awal..."
            />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Vital Sign</h2>
            <p className="text-sm text-muted-foreground">
              Nilai di luar rentang wajar ditandai sebelum disimpan (mis. salah ketik).
            </p>
            {/* Validasi rentang: `error` memblokir langkah berikutnya,
                peringatan klinis hanya ditampilkan sebagai catatan. */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sistolik (mmHg)"
                type="number"
                inputMode="numeric"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="120"
                error={vitalFieldError(vitals.byField.systolicBp)}
                helper={VITAL_SPECS.systolicBp.hint}
              />
              <Input
                label="Diastolik (mmHg)"
                type="number"
                inputMode="numeric"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="80"
                error={vitalFieldError(vitals.byField.diastolicBp)}
                helper={VITAL_SPECS.diastolicBp.hint}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Heart Rate (bpm)"
                type="number"
                inputMode="numeric"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                placeholder="72"
                error={vitalFieldError(vitals.byField.pulse)}
                helper={VITAL_SPECS.pulse.hint}
              />
              <Input
                label="Suhu (°C)"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                placeholder="36.5"
                error={vitalFieldError(vitals.byField.temperature)}
                helper={VITAL_SPECS.temperature.hint}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tinggi Badan (cm)"
                type="number"
                inputMode="numeric"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="170"
                error={vitalFieldError(vitals.byField.heightCm)}
                helper={VITAL_SPECS.heightCm.hint}
              />
              <Input
                label="Berat Badan (kg)"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="65"
                error={vitalFieldError(vitals.byField.weightKg)}
                helper={VITAL_SPECS.weightKg.hint}
              />
            </div>
            {vitalWarningCount(vitals) > 0 && (
              <div className="rounded-xl bg-warning-50 p-3 text-sm text-warning-700" role="status">
                {vitalWarningCount(vitals)} nilai perlu perhatian — data tetap dapat disimpan.
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Review & Submit</h2>
            <div className="rounded-xl border border-border bg-muted p-4">
              <h3 className="mb-3 text-sm font-medium text-text-secondary">Ringkasan</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-text-secondary">Pasien:</span> {selectedEmployee?.fullName}</p>
                <p><span className="font-medium text-text-secondary">Lokasi:</span> {selectedLocation?.name}</p>
                <p><span className="font-medium text-text-secondary">Keluhan:</span> {chiefComplaint}</p>
                <p><span className="font-medium text-text-secondary">TD:</span> {systolic}/{diastolic} mmHg</p>
                <p><span className="font-medium text-text-secondary">HR:</span> {heartRate} bpm</p>
                <p><span className="font-medium text-text-secondary">BB/TB:</span> {weight} kg / {height} cm</p>
              </div>
            </div>
            {submitError && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                {submitError}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <Button variant="ghost" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>
            <ChevronLeft className="size-4" />
            Kembali
          </Button>
          {currentStep < 5 ? (
            <Button onClick={() => setCurrentStep((s) => Math.min(5, s + 1))} disabled={!canProceed()}>
              Lanjut
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Can action="visits.create">
              <Button onClick={handleSubmit} loading={submitting}>
                <Check className="size-4" />
                Submit Kunjungan
              </Button>
            </Can>
          )}
        </div>
      </Card>
    </div>
  );
}
